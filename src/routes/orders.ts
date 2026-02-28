import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";
import { AuthedRequest, verifyToken } from "../middlewares/auth";
import { onlyAdmin } from "../middlewares/onlyAdmin";

const router = Router();

function parseYear(input: unknown): number {
  const y = Number(input);
  const now = new Date().getFullYear();
  if (!Number.isFinite(y)) return now;
  if (y < 2000 || y > 2100) return now; // กันปีเพี้ยน
  return Math.trunc(y);
}

function yearRange(year: number) {
  const start = `${year}-01-01 00:00:00`;
  const end = `${year + 1}-01-01 00:00:00`;
  return { start, end };
}

/** --------------------------
 *  Notification helper
 *  - ไม่ให้แจ้งเตือนพัง API หลัก
 * -------------------------- */
type ConnLike = {
  query: (sql: string, params?: any[]) => Promise<any>;
};

async function safeNotify(
  conn: ConnLike,
  args: {
    customerId: number;
    type: string;
    title: string;
    body: string;
    link: string;
  }
) {
  try {
    await conn.query(
      `INSERT INTO notifications
       (customer_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [args.customerId, args.type, args.title, args.body, args.link]
    );
  } catch {
    // ignore
  }
}

interface Order extends RowDataPacket {
  Oid: number;
  Cid: number;
  Oprice: number;
  Odate: string;
  Ostatus: string;
  Oslip: string;
  Opayment: string;
}
interface AdminOrder extends RowDataPacket {
  Oid: number;
  Oprice: number;
  Ostatus: string;
  Odate: string;
  Cname: string;
}

interface OrderItem extends RowDataPacket {
  Oiid: number;
  Oid: number;
  Pid: number;
  Oquantity: number;
  Oprice: number;
  Pname: string;
  Ppicture: string;
}
interface OrderSummary extends RowDataPacket {
  Oid: number;
  Odate: string;
  Ostatus: string;
  Ototal: number;
  products: string;
}
interface StatsResult extends RowDataPacket {
  totalOrders: number;
  totalSales: number;
  cancelledOrders: number;
  failedOrders: number;
  salesToday: number;
  salesThisWeek: number;
  salesThisMonth: number;
}

interface ReviewRow extends RowDataPacket {
  id: number;
  text: string;
  stars: number;
  created_at: string; // หรือ Date ก็ได้ ถ้า parse แล้ว
  order_id: number;
}

/**
 * PUT /orders/:id
 * - อัปเดตสถานะ + ลด/คืนสต๊อกตามเงื่อนไข + แจ้งเตือนลูกค้า
 * - (คงฟังก์ชันเดิมตามที่ตะเองสั่ง ห้ามลบ)
 */
router.put("/orders/:id", async (req, res, next) => {
  const { id } = req.params;
  const { Ostatus } = req.body;

  if (!Ostatus) {
    return res.status(400).json({ message: "ต้องระบุ Ostatus" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1) ดึงข้อมูลเดิม
    const [orders] = await conn.query<RowDataPacket[]>(
      `SELECT Cid, Opayment, Ostatus FROM orders WHERE Oid = ?`,
      [id]
    );

    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }

    const order = orders[0];
    const oldStatus = String(order.Ostatus);

    // ถ้า status เดิม = ใหม่ ไม่ต้องทำอะไร
    if (oldStatus === Ostatus) {
      await conn.rollback();
      return res.status(400).json({ message: "สถานะเหมือนเดิม" });
    }

    // 2) ดึงรายการสินค้า
    const [items] = await conn.query<RowDataPacket[]>(
      `SELECT Pid, Oquantity FROM order_items WHERE Oid = ?`,
      [id]
    );

    // ลดสต๊อกตอน paid ครั้งแรก
    if (oldStatus !== "paid" && Ostatus === "paid") {
      for (const item of items) {
        await conn.query(
          `UPDATE products
           SET Pnumproduct = Pnumproduct - ?,
               Prenume = COALESCE(Prenume,0) + ?
           WHERE Pid = ?`,
          [item.Oquantity, item.Oquantity, item.Pid]
        );
      }
    }

    // ลดสต๊อกตอน shipping สำหรับ COD (ครั้งแรกเท่านั้น)
    if (
      oldStatus !== "shipping" &&
      Ostatus === "shipping" &&
      String(order.Opayment).toLowerCase() === "cod"
    ) {
      for (const item of items) {
        await conn.query(
          `UPDATE products
           SET Pnumproduct = Pnumproduct - ?,
               Prenume = COALESCE(Prenume,0) + ?
           WHERE Pid = ?`,
          [item.Oquantity, item.Oquantity, item.Pid]
        );
      }
    }

    // 3) อัปเดตสถานะ
    await conn.query(`UPDATE orders SET Ostatus = ? WHERE Oid = ?`, [Ostatus, id]);

    // 4) ยิงแจ้งเตือนตามสถานะใหม่ (เฉพาะสถานะที่ควรแจ้ง)
    const link = `/me/orders/${id}`;

    if (Ostatus === "payment_review") {
      await safeNotify(conn, {
        customerId: Number(order.Cid),
        type: "payment_review",
        title: "กำลังตรวจสอบการชำระเงิน",
        body: `คำสั่งซื้อ #${id} อยู่ระหว่างตรวจสอบ`,
        link,
      });
    }

    if (Ostatus === "paid") {
      await safeNotify(conn, {
        customerId: Number(order.Cid),
        type: "payment_approved",
        title: "ชำระเงินสำเร็จ",
        body: `คำสั่งซื้อ #${id} ได้รับการยืนยันการชำระเงินแล้ว`,
        link,
      });
    }

    if (Ostatus === "shipping") {
      await safeNotify(conn, {
        customerId: Number(order.Cid),
        type: "order_shipping",
        title: "กำลังจัดส่ง",
        body: `คำสั่งซื้อ #${id} กำลังจัดส่งแล้ว`,
        link,
      });
    }

    if (Ostatus === "delivered") {
      await safeNotify(conn, {
        customerId: Number(order.Cid),
        type: "order_delivered",
        title: "จัดส่งสำเร็จ",
        body: `คำสั่งซื้อ #${id} จัดส่งสำเร็จแล้ว`,
        link,
      });
    }

    if (Ostatus === "cancelled") {
      await safeNotify(conn, {
        customerId: Number(order.Cid),
        type: "order_cancelled",
        title: "คำสั่งซื้อถูกยกเลิก",
        body: `คำสั่งซื้อ #${id} ถูกยกเลิกโดยผู้ดูแลระบบ`,
        link,
      });
    }

    await conn.commit();
    res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
  } finally {
    conn.release();
  }
});

router.get("/orders/all", verifyToken, onlyAdmin, async (req, res) => {
  const year = parseYear(req.query.year);
  const { start, end } = yearRange(year);

  const limitRaw = req.query.limit;
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 200) : null;

  const type = String(req.query.type || "all");

  const connection = await pool.getConnection();
  try {
    const where: string[] = ["o.Odate >= ? AND o.Odate < ?"];
    const params: any[] = [start, end];

    // filter ตามชนิดงาน
    if (type === "latest_new") {
      where.push(`o.Ostatus IN ('pending_payment','payment_review','paid')`);
    } else if (type === "payment_review") {
      where.push(`o.Ostatus = 'payment_review'`);
    } else if (type === "to_ship") {
      where.push(`o.Ostatus = 'paid'`);
    } else if (type === "cod_pending") {
      where.push(`o.Opayment = 'cod' AND o.Ostatus = 'pending_payment'`);
    }

    const sql = `
      SELECT o.Oid, o.Oprice, o.Ostatus, o.Opayment, o.Odate, c.Cname
      FROM orders o
      JOIN customers c ON o.Cid = c.Cid
      WHERE ${where.join(" AND ")}
      ORDER BY o.Odate DESC
      ${limit ? "LIMIT ?" : ""}
    `;

    if (limit) params.push(limit);

    const [orders] = await connection.query<AdminOrder[]>(sql, params);
    res.status(200).json(orders);
  } catch (err) {
    console.error("ADMIN GET ALL ORDERS ERROR:", err);
    res.status(500).json({ message: "ไม่สามารถโหลดคำสั่งซื้อได้" });
  } finally {
    connection.release();
  }
});

router.post("/orders", async (req, res, next) => {
  const { Cid, items, payment, totalPrice } = req.body as {
    Cid: number | string;
    items: Array<{ Pid: number; quantity: number; price: number }>;
    payment: string;
    totalPrice: number;
  };

  if (!Cid || !Array.isArray(items) || items.length === 0 || totalPrice === undefined) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
  }

  const conn = await pool.getConnection();

  try {
    for (const item of items) {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT Pnumproduct FROM products WHERE Pid = ?",
        [item.Pid]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "ไม่พบสินค้า", Pid: item.Pid });
      }

      const stock = Number(rows[0].Pnumproduct ?? 0);
      const qty = Number(item.quantity ?? 0);

      if (stock < qty) {
        return res.status(400).json({
          message: "สินค้าในคลังไม่พอ",
          Pid: item.Pid,
          available: stock,
        });
      }
    }

    await conn.beginTransaction();

    const [orderResult] = await conn.query<ResultSetHeader>(
      "INSERT INTO orders (Cid, Oprice, Odate, Ostatus, Opayment) VALUES (?, ?, NOW(), ?, ?)",
      [Number(Cid), Number(totalPrice), "pending_payment", String(payment)]
    );

    const Oid = orderResult.insertId;

    for (const item of items) {
      await conn.query(
        "INSERT INTO order_items (Oid, Pid, Oquantity, Oprice) VALUES (?, ?, ?, ?)",
        [Oid, item.Pid, item.quantity, item.price]
      );
    }

    // แจ้งเตือนสร้างคำสั่งซื้อ
    await safeNotify(conn, {
      customerId: Number(Cid),
      type: "order_created",
      title: "สร้างคำสั่งซื้อสำเร็จ",
      body: `เลขที่คำสั่งซื้อ #${Oid} ยอดรวม ${Number(totalPrice).toLocaleString("th-TH")} บาท`,
      link: `/me/orders/${Oid}`,
    });

    await conn.commit();

    return res.status(200).json({
      message: "สร้างคำสั่งซื้อสำเร็จ",
      orderId: Oid,
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
});

router.get("/orders", async (req, res, next) => {
  const { Cid } = req.query;

  if (!Cid) {
    return res.status(400).json({ message: "ต้องระบุ Cid" });
  }

  const connection = await pool.getConnection();
  try {
    interface OrderX extends RowDataPacket {
      Oid: number;
      Cid: number;
      Oprice: number;
      Odate: string;
      Ostatus: string;
    }

    const [orders] = await connection.query<OrderX[]>(
      "SELECT * FROM orders WHERE Cid = ? ORDER BY Odate DESC",
      [Cid]
    );

    const orderIds = orders.map((order) => order.Oid);

    if (orderIds.length === 0) {
      return res.json([]);
    }

    const [items] = await connection.query<OrderItem[]>(
      `SELECT oi.*, p.Pname, p.Ppicture
             FROM order_items oi
             JOIN products p ON oi.Pid = p.Pid
             WHERE oi.Oid IN (?)`,
      [orderIds]
    );

    const orderMap = orders.map((order) => {
      return {
        ...order,
        items: items.filter((item) => item.Oid === order.Oid),
      };
    });

    res.json(orderMap);
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

router.get("/orders/:id", async (req, res, next) => {
  const { id } = req.params;

  const connection = await pool.getConnection();
  try {
    const [orders] = await connection.query<RowDataPacket[]>(
      `SELECT
          o.*,
          c.Cname,
          c.Cphone,
          CONCAT(c.Caddress, ' ', c.Csubdistrict, ' ', c.Cdistrict, ' ', c.Cprovince, ' ', c.Czipcode) AS Caddress
       FROM orders o
       JOIN customers c ON o.Cid = c.Cid
       WHERE o.Oid = ?`,
      [id]
    );

    const [items] = await connection.query<RowDataPacket[]>(
      `SELECT oi.*, p.Pname, p.Ppicture
       FROM order_items oi
       JOIN products p ON oi.Pid = p.Pid
       WHERE oi.Oid = ?`,
      [id]
    );

    res.json({ ...orders[0], items });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

router.patch("/orders/:id/slip", verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { slipUrl } = req.body;

  if (!slipUrl) {
    return res.status(400).json({ message: "ต้องแนบ slipUrl" });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT Cid, Opayment, Ostatus FROM orders WHERE Oid = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }

    const order = rows[0];
    const user = (req as AuthedRequest).user;

    if (!user || user.role !== "user" || user.Cid !== order.Cid) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขคำสั่งซื้อนี้" });
    }

    if (order.Opayment === "cod") {
      return res.status(400).json({
        message: "คำสั่งซื้อแบบเก็บเงินปลายทาง ไม่ต้องแนบสลิป",
      });
    }

    if (order.Ostatus !== "pending_payment") {
      return res.status(400).json({
        message: "สถานะไม่ถูกต้องสำหรับการแนบสลิป",
      });
    }

    await pool.query(
      `UPDATE orders
       SET Oslip = ?, Ostatus = 'payment_review'
       WHERE Oid = ?`,
      [slipUrl, id]
    );

    // แจ้งเตือนลูกค้า
    await safeNotify(pool as unknown as ConnLike, {
      customerId: Number(order.Cid),
      type: "payment_uploaded",
      title: "แนบสลิปสำเร็จ",
      body: `คำสั่งซื้อ #${id} ถูกส่งสลิปและรอตรวจสอบ`,
      link: `/me/orders/${id}`,
    });

    res.json({ message: "บันทึกสลิปสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id/cancel", verifyToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT Cid, Ostatus FROM orders WHERE Oid = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }

    const order = rows[0];
    const user = (req as AuthedRequest).user;

    if (!user || user.role !== "user" || user.Cid !== order.Cid) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้" });
    }

    if (["paid", "shipping", "delivered"].includes(order.Ostatus)) {
      return res.status(400).json({ message: "ไม่สามารถยกเลิกได้ในสถานะนี้" });
    }

    // อัปเดตสถานะ
    await pool.query("UPDATE orders SET Ostatus = 'cancelled' WHERE Oid = ?", [id]);

    // ใส่แจ้งเตือน
    await safeNotify(pool as unknown as ConnLike, {
      customerId: Number(order.Cid),
      type: "order_cancelled",
      title: "ยกเลิกคำสั่งซื้อแล้ว",
      body: `คำสั่งซื้อ #${id} ถูกยกเลิกเรียบร้อย`,
      link: `/me/orders/${id}`,
    });

    res.json({ message: "ยกเลิกคำสั่งซื้อแล้ว" });
  } catch (err) {
    next(err);
  }
});

router.get("/orders/customer/:id", async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT o.Oid, o.Odate, o.Ostatus, o.Oprice,
            GROUP_CONCAT(p.Pname SEPARATOR ', ') AS products
     FROM orders o
     LEFT JOIN order_items oi ON o.Oid = oi.Oid
     LEFT JOIN products p ON oi.Pid = p.Pid
     WHERE o.Cid = ?
     GROUP BY o.Oid
     ORDER BY o.Oid DESC`,
        [req.params.id]
      );

      res.json([...rows]);
    } catch (error) {
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /orders/stats
router.get("/stats", async (req, res) => {
  try {
    const [rows] = await pool.query<StatsResult[]>(`
      SELECT
        COUNT(*) AS totalOrders,
        SUM(Oprice) AS totalSales,
        SUM(CASE WHEN Ostatus = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
        SUM(CASE WHEN Ostatus = 'failed' THEN 1 ELSE 0 END) AS failedOrders,
        SUM(CASE WHEN DATE(Odate) = CURDATE() THEN Oprice ELSE 0 END) AS salesToday,
        SUM(CASE WHEN YEARWEEK(Odate, 1) = YEARWEEK(CURDATE(), 1) THEN Oprice ELSE 0 END) AS salesThisWeek,
        SUM(CASE WHEN MONTH(Odate) = MONTH(CURDATE()) AND YEAR(Odate) = YEAR(CURDATE()) THEN Oprice ELSE 0 END) AS salesThisMonth
      FROM orders
    `);

    console.log("Stats:", rows);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error loading stats:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดสถิติได้" });
  }
});

router.patch("/orders/:id/confirm", async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      // ดึง Cid ก่อนเพื่อแจ้งเตือน (ไม่แก้ flow เดิม)
      const [beforeRows] = await connection.query<RowDataPacket[]>(
        `SELECT Cid, Ostatus FROM orders WHERE Oid = ?`,
        [req.params.id]
      );

      if (beforeRows.length === 0) {
        return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
      }

      const customerId = Number(beforeRows[0].Cid);

      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE orders SET Ostatus = 'delivered' WHERE Oid = ? AND Ostatus = 'shipping'`,
        [req.params.id]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: "ไม่สามารถยืนยันได้ (สถานะไม่ใช่ shipping)" });
      }

      // แจ้งเตือน delivered
      await safeNotify(connection as unknown as ConnLike, {
        customerId,
        type: "order_delivered",
        title: "จัดส่งสำเร็จ",
        body: `คำสั่งซื้อ #${req.params.id} จัดส่งสำเร็จแล้ว`,
        link: `/me/orders/${req.params.id}`,
      });

      res.json({ message: "ยืนยันรับสินค้าเรียบร้อยแล้ว" });
    } catch (error) {
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id/review
router.get("/orders/:id/review", async (req, res) => {
  const orderId = req.params.id;
  try {
    const [rows] = await pool.query<ReviewRow[]>("SELECT * FROM reviews WHERE order_id = ?", [
      orderId,
    ]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error("Error fetching review:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดรีวิวได้" });
  }
});

router.post("/orders/:id/review", async (req, res) => {
  const { text, stars } = req.body;
  const orderId = req.params.id;

  try {
    // เช็กก่อนว่ามีอยู่แล้วหรือยัง
    const [existing] = await pool.query<ReviewRow[]>("SELECT * FROM reviews WHERE order_id = ?", [
      orderId,
    ]);

    if (existing.length > 0) {
      return res.status(400).json({ message: "รีวิวนี้ถูกส่งไปแล้ว" });
    }

    // ยังไม่มี -> สร้างรีวิวใหม่
    await pool.query("INSERT INTO reviews (text, stars, order_id) VALUES (?, ?, ?)", [
      text,
      stars,
      orderId,
    ]);

    res.status(201).json({ message: "Review created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating review" });
  }
});

/**
 * PATCH /orders/:id/status
 * - คง route เก่าไว้ (ห้ามลบ)
 * - เพิ่ม: แจ้งเตือนตามสถานะ
 * - เพิ่ม: ลดสต๊อกตอน COD -> shipping (ให้ consistent กับ PUT)
 */
router.patch("/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // ดึงข้อมูลเดิม (เพิ่ม Cid + Opayment เพื่อแจ้งเตือน/เงื่อนไข COD)
    const [orderRows] = await conn.query<RowDataPacket[]>(
      "SELECT Cid, Opayment, Ostatus FROM orders WHERE Oid = ?",
      [id]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    }

    const row = orderRows[0];
    const customerId = Number(row.Cid);
    const oldStatus = String(row.Ostatus);
    const payment = String(row.Opayment || "").toLowerCase();

    if (!status) {
      await conn.rollback();
      return res.status(400).json({ message: "ต้องระบุ status" });
    }

    if (oldStatus === status) {
      await conn.rollback();
      return res.status(400).json({ message: "สถานะเหมือนเดิม" });
    }

    // อัปเดตสถานะใหม่
    await conn.query("UPDATE orders SET Ostatus = ? WHERE Oid = ?", [status, id]);

    // ลดสต๊อกครั้งแรกตอน paid
    if (oldStatus !== "paid" && status === "paid") {
      const [items] = await conn.query<RowDataPacket[]>(
        "SELECT Pid, Oquantity FROM order_items WHERE Oid = ?",
        [id]
      );

      for (const item of items) {
        await conn.query(
          "UPDATE products SET Pnumproduct = Pnumproduct - ?, Prenume = Prenume + ? WHERE Pid = ?",
          [item.Oquantity, item.Oquantity, item.Pid]
        );
      }
    }

    // ลดสต๊อกตอน shipping สำหรับ COD (ครั้งแรกเท่านั้น)
    if (oldStatus !== "shipping" && status === "shipping" && payment === "cod") {
      const [items] = await conn.query<RowDataPacket[]>(
        "SELECT Pid, Oquantity FROM order_items WHERE Oid = ?",
        [id]
      );

      for (const item of items) {
        await conn.query(
          `UPDATE products
           SET Pnumproduct = Pnumproduct - ?,
               Prenume = COALESCE(Prenume,0) + ?
           WHERE Pid = ?`,
          [item.Oquantity, item.Oquantity, item.Pid]
        );
      }
    }

    // คืนสต๊อกถ้า old = paid แล้ว -> cancelled
    if (oldStatus === "paid" && status === "cancelled") {
      const [items] = await conn.query<RowDataPacket[]>(
        "SELECT Pid, Oquantity FROM order_items WHERE Oid = ?",
        [id]
      );

      for (const item of items) {
        await conn.query(
          "UPDATE products SET Pnumproduct = Pnumproduct + ?, Prenume = Prenume - ? WHERE Pid = ?",
          [item.Oquantity, item.Oquantity, item.Pid]
        );
      }
    }

    // แจ้งเตือน (ตามสถานะที่ควรแจ้ง)
    const link = `/me/orders/${id}`;

    if (status === "payment_review") {
      await safeNotify(conn, {
        customerId,
        type: "payment_review",
        title: "กำลังตรวจสอบการชำระเงิน",
        body: `คำสั่งซื้อ #${id} อยู่ระหว่างตรวจสอบ`,
        link,
      });
    }

    if (status === "paid") {
      await safeNotify(conn, {
        customerId,
        type: "payment_approved",
        title: "ชำระเงินสำเร็จ",
        body: `คำสั่งซื้อ #${id} ได้รับการยืนยันการชำระเงินแล้ว`,
        link,
      });
    }

    if (status === "shipping") {
      await safeNotify(conn, {
        customerId,
        type: "order_shipping",
        title: "กำลังจัดส่ง",
        body: `คำสั่งซื้อ #${id} กำลังจัดส่งแล้ว`,
        link,
      });
    }

    if (status === "delivered") {
      await safeNotify(conn, {
        customerId,
        type: "order_delivered",
        title: "จัดส่งสำเร็จ",
        body: `คำสั่งซื้อ #${id} จัดส่งสำเร็จแล้ว`,
        link,
      });
    }

    if (status === "cancelled") {
      await safeNotify(conn, {
        customerId,
        type: "order_cancelled",
        title: "คำสั่งซื้อถูกยกเลิก",
        body: `คำสั่งซื้อ #${id} ถูกยกเลิกโดยผู้ดูแลระบบ`,
        link,
      });
    }

    await conn.commit();
    res.json({ message: "อัปเดตสถานะเรียบร้อย" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  } finally {
    conn.release();
  }
});

/// GET /stats/full — รวมข้อมูลทั้งหมดของร้าน (optional ?year=YYYY)
// เพิ่ม: ส่ง “หมวดหลักก่อน” + “หมวดย่อย” ครบ
// - categoryRevenueByType  (หมวดหลักรวม)
// - categoryRevenue        (หมวดย่อย type+subtype)
// - stockByType            (หมวดหลักรวม)
// - stockByCategory        (หมวดย่อย type+subtype)
router.get("/stats/full", verifyToken, onlyAdmin, async (req, res) => {
  const safe = async <T extends RowDataPacket[]>(
    name: string,
    sql: string,
    params: any[] = []
  ) => {
    try {
      const [rows] = await pool.query<T>(sql, params);
      return rows;
    } catch (e) {
      console.error(`STATS SKIP @ ${name}:`, e);
      return [] as unknown as T;
    }
  };

  // optional year
  const hasYear = typeof req.query.year !== "undefined";
  let year: number | null = null;
  let start = "";
  let end = "";

  if (hasYear) {
    year = parseYear(req.query.year);
    const r = yearRange(year);
    start = r.start;
    end = r.end;
  }

  // helper: date filter for orders (alias o)
  const orderDateFilterO = hasYear ? `WHERE o.Odate >= ? AND o.Odate < ?` : ``;
  const orderDateParams = hasYear ? [start, end] : [];

  // helper: date filter for auctions (alias a)
  const auctionDateFilterA = hasYear ? `WHERE a.end_time >= ? AND a.end_time < ?` : ``;
  const auctionDateParams = hasYear ? [start, end] : [];

  // เงื่อนไข “รายได้จริง”
  // - โอน/transfer: นับเมื่อ paid/shipping/delivered
  // - COD: นับเมื่อ shipping/delivered
  const REAL_REVENUE_WHERE = `
    (
      (o.Opayment IN ('bank','transfer','bank_transfer') AND o.Ostatus IN ('paid','shipping','delivered'))
      OR
      (o.Opayment = 'cod' AND o.Ostatus IN ('shipping','delivered'))
    )
  `;

  try {
    /* ---------------- 1) Orders (ขายปกติ) ---------------- */
    const [orderStats] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        COUNT(*) AS totalOrders,

        SUM(
          CASE
            WHEN
              (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus IN ('paid','shipping','delivered'))
              OR
              (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
            THEN Oprice ELSE 0 END
        ) AS orderSales,

        SUM(CASE WHEN Ostatus = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
        SUM(CASE WHEN Ostatus = 'failed' THEN 1 ELSE 0 END) AS failedOrders,

        SUM(
          CASE
            WHEN DATE(Odate) = CURDATE()
              AND (
                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus IN ('paid','shipping','delivered'))
                OR
                (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
              )
            THEN Oprice ELSE 0 END
        ) AS orderToday,

        SUM(
          CASE
            WHEN MONTH(Odate) = MONTH(CURDATE())
              AND YEAR(Odate) = YEAR(CURDATE())
              AND (
                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus IN ('paid','shipping','delivered'))
                OR
                (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
              )
            THEN Oprice ELSE 0 END
        ) AS orderMonth,

        SUM(
          CASE
            WHEN Opayment IN ('bank','transfer','bank_transfer')
              AND Ostatus IN ('paid','shipping','delivered')
            THEN Oprice ELSE 0 END
        ) AS bankSales,

        SUM(
          CASE
            WHEN Opayment = 'cod'
              AND Ostatus IN ('shipping','delivered')
            THEN Oprice ELSE 0 END
        ) AS codSales

      FROM orders
      ${hasYear ? `WHERE Odate >= ? AND Odate < ?` : ``}
      `,
      hasYear ? [start, end] : []
    );

    /* ---------------- 2) Auctions ---------------- */
    const [auctionStats] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        COUNT(*) AS totalAuctions,

        SUM(
          CASE WHEN ap.PROstatus = 'paid'
            THEN a.current_price ELSE 0 END
        ) AS auctionSales,

        SUM(CASE WHEN ap.PROstatus = 'paid' THEN 1 ELSE 0 END) AS soldAuctionCount,
        SUM(CASE WHEN ap.PROstatus = 'unsold' THEN 1 ELSE 0 END) AS unsoldAuctionCount

      FROM auction_products ap
      JOIN auctions a ON a.PROid = ap.PROid
      ${auctionDateFilterA}
      `,
      auctionDateParams
    );

    /* ---------------- 3) Reports ---------------- */

    // A) Order status overview
    const orderStatusOverview = await safe<RowDataPacket[]>(
      "orderStatusOverview",
      `
      SELECT o.Ostatus AS status, COUNT(*) AS count
      FROM orders o
      ${orderDateFilterO}
      GROUP BY o.Ostatus
      ORDER BY COUNT(*) DESC
      `,
      orderDateParams
    );

    // B) Top products (สินค้า) — ใส่หมวดหลัก + หมวดย่อย
    const topProducts = await safe<RowDataPacket[]>(
      "topProducts",
      `
      SELECT
        p.Pid AS product_id,
        p.Pname AS name,
        COALESCE(t.typenproduct, 'ไม่ระบุหมวด') AS type,
        COALESCE(st.subname, 'ไม่ระบุหมวดย่อย') AS subtype,
        SUM(oi.Oquantity) AS qty,
        SUM(oi.Oquantity * oi.Oprice) AS revenue
      FROM order_items oi
      JOIN orders o ON o.Oid = oi.Oid
      JOIN products p ON p.Pid = oi.Pid
      LEFT JOIN product_types t ON t.Typeid = p.Typeid
      LEFT JOIN subtypes st ON st.Subtypeid = p.Subtypeid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""}
        ${REAL_REVENUE_WHERE}
      GROUP BY p.Pid, p.Pname, type, subtype
      ORDER BY revenue DESC
      LIMIT 100
      `,
      hasYear ? [start, end] : []
    );

    // C1) Category revenue by TYPE+SUBTYPE (รายละเอียด)
    const categoryRevenue = await safe<RowDataPacket[]>(
      "categoryRevenue",
      `
      SELECT
        COALESCE(t.typenproduct, 'ไม่ระบุหมวด') AS type,
        COALESCE(st.subname, 'ไม่ระบุหมวดย่อย') AS subtype,
        SUM(oi.Oquantity) AS qty,
        SUM(oi.Oquantity * oi.Oprice) AS revenue
      FROM order_items oi
      JOIN orders o ON o.Oid = oi.Oid
      JOIN products p ON p.Pid = oi.Pid
      LEFT JOIN product_types t ON t.Typeid = p.Typeid
      LEFT JOIN subtypes st ON st.Subtypeid = p.Subtypeid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""}
        ${REAL_REVENUE_WHERE}
      GROUP BY type, subtype
      ORDER BY revenue DESC
      LIMIT 200
      `,
      hasYear ? [start, end] : []
    );

    // C2) Category revenue by TYPE (หมวดหลักก่อน)
    const categoryRevenueByType = await safe<RowDataPacket[]>(
      "categoryRevenueByType",
      `
      SELECT
        COALESCE(t.typenproduct, 'ไม่ระบุหมวด') AS type,
        SUM(oi.Oquantity) AS qty,
        SUM(oi.Oquantity * oi.Oprice) AS revenue
      FROM order_items oi
      JOIN orders o ON o.Oid = oi.Oid
      JOIN products p ON p.Pid = oi.Pid
      LEFT JOIN product_types t ON t.Typeid = p.Typeid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""}
        ${REAL_REVENUE_WHERE}
      GROUP BY type
      ORDER BY revenue DESC
      LIMIT 500
      `,
      hasYear ? [start, end] : []
    );

    // D1) Stock by category (TYPE+SUBTYPE รายละเอียด)
    const LOW_STOCK_THRESHOLD = 10;

    const stockByCategory = await safe<RowDataPacket[]>(
      "stockByCategory",
      `
      SELECT
        COALESCE(t.typenproduct, 'ไม่ระบุหมวด') AS type,
        COALESCE(st.subname, 'ไม่ระบุหมวดย่อย') AS subtype,
        COUNT(p.Pid) AS total_products,
        SUM(p.Pnumproduct) AS total_stock,
        SUM(CASE WHEN p.Pnumproduct <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS low_stock
      FROM products p
      LEFT JOIN product_types t ON t.Typeid = p.Typeid
      LEFT JOIN subtypes st ON st.Subtypeid = p.Subtypeid
      GROUP BY type, subtype
      ORDER BY total_stock DESC
      LIMIT 500
      `
    );

    // D2) Stock by TYPE (หมวดหลักก่อน)
    const stockByType = await safe<RowDataPacket[]>(
      "stockByType",
      `
      SELECT
        COALESCE(t.typenproduct, 'ไม่ระบุหมวด') AS type,
        COUNT(p.Pid) AS total_products,
        SUM(p.Pnumproduct) AS total_stock,
        SUM(CASE WHEN p.Pnumproduct <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS low_stock
      FROM products p
      LEFT JOIN product_types t ON t.Typeid = p.Typeid
      GROUP BY type
      ORDER BY total_stock DESC
      LIMIT 100
      `
    );

    const lowStockProducts = await safe<RowDataPacket[]>(
      "lowStockProducts",
      `
      SELECT
        p.Pid AS product_id,
        p.Pname AS name,
        COALESCE(TRIM(t.typenproduct), 'ไม่ระบุหมวด') AS type,
        COALESCE(TRIM(st.subname), 'ไม่ระบุหมวดย่อย') AS subtype,
        p.Pnumproduct AS stock
      FROM products p
      LEFT JOIN product_types t ON p.Typeid = t.Typeid
      LEFT JOIN subtypes st ON p.Subtypeid = st.Subtypeid
      WHERE p.Pnumproduct <= 10
      ORDER BY p.Pnumproduct ASC
      LIMIT 100
      `
    );

    // E) Top customers (นับเฉพาะรายได้จริง)
    const topCustomers = await safe<RowDataPacket[]>(
      "topCustomers",
      `
      SELECT
        cu.Cid AS customer_id,
        cu.Cname AS name,
        COUNT(o.Oid) AS orders,
        SUM(o.Oprice) AS total_spent,
        AVG(o.Oprice) AS avg_order
      FROM orders o
      JOIN customers cu ON cu.Cid = o.Cid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""}
        ${REAL_REVENUE_WHERE}
      GROUP BY cu.Cid, cu.Cname
      ORDER BY total_spent DESC
      LIMIT 10
      `,
      hasYear ? [start, end] : []
    );

    /* ---------------- 4) Auction performance ---------------- */
    let auctionParticipationAvg: number | null = null;
    let auctionClosedRate: number | null = null;

    try {
      const [avgJoin] = await pool.query<RowDataPacket[]>(
        `
        SELECT AVG(cnt) AS avg_participants
        FROM (
          SELECT a.Aid, COUNT(b.Bidid) AS cnt
          FROM auctions a
          LEFT JOIN bids b ON b.auction_id = a.Aid
          ${auctionDateFilterA}
          GROUP BY a.Aid
        ) t
        `,
        auctionDateParams
      );

      const sold = Number(auctionStats?.[0]?.soldAuctionCount || 0);
      const unsold = Number(auctionStats?.[0]?.unsoldAuctionCount || 0);
      const closed = sold + unsold || 0;

      auctionParticipationAvg = Number(avgJoin?.[0]?.avg_participants ?? 0);
      auctionClosedRate = closed > 0 ? (sold / closed) * 100 : 0;
    } catch {
      auctionParticipationAvg = null;
      auctionClosedRate = null;
    }

    /* ---------------- 5) Total ---------------- */
    const totalSales =
      Number(orderStats?.[0]?.orderSales || 0) + Number(auctionStats?.[0]?.auctionSales || 0);

    res.json({
      year,
      range: hasYear ? { start, end } : null,

      ...orderStats[0],
      ...auctionStats[0],
      totalSales,

      orderStatusOverview,

      topProducts,

      categoryRevenueByType,
      categoryRevenue,

      stockByType,
      stockByCategory,

      lowStockProducts,
      topCustomers,

      auctionParticipationAvg,
      auctionClosedRate,
    });
  } catch (err) {
    console.error("STATS ERROR:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดสถิติได้" });
  }
});

router.patch("/orders/:id/shipping", async (req, res) => {
  const { id } = req.params;
  const { Oshipping, Otracking } = req.body;

  if (!Oshipping || !Otracking) {
    return res.status(400).json({ message: "ข้อมูลจัดส่งไม่ครบ" });
  }

  try {
    // ดึง Cid ก่อนเพื่อแจ้งเตือน
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT Cid FROM orders WHERE Oid = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    const customerId = Number(rows[0].Cid);

    await pool.query(
      `UPDATE orders
             SET Oshipping = ?, Otracking = ?, Ostatus = 'shipping'
             WHERE Oid = ?`,
      [Oshipping, Otracking, id]
    );

    // แจ้งเตือน shipping (ใส่เลขพัสดุให้ด้วย)
    await safeNotify(pool as unknown as ConnLike, {
      customerId,
      type: "order_shipping",
      title: "กำลังจัดส่ง",
      body: `คำสั่งซื้อ #${id} กำลังจัดส่งแล้ว (${String(Oshipping)} - ${String(Otracking)})`,
      link: `/me/orders/${id}`,
    });

    res.json({ message: "อัปเดตข้อมูลจัดส่งสำเร็จ" });
  } catch (err) {
    console.error("SHIPPING UPDATE ERROR:", err);
    res.status(500).json({ message: "อัปเดตจัดส่งไม่สำเร็จ" });
  }
});

router.patch("/orders/:id/shipping/edit", async (req, res) => {
  const { id } = req.params;
  const { shipping_company, tracking_number } = req.body;

  if (!shipping_company || !tracking_number) {
    return res.status(400).json({ message: "ข้อมูลจัดส่งไม่ครบ" });
  }

  try {
    await pool.query(
      `UPDATE orders
             SET shipping_company = ?,
                 tracking_number = ?
             WHERE Oid = ?`,
      [shipping_company, tracking_number, id]
    );

    // (อันนี้เป็น edit เฉยๆ ไม่เปลี่ยนสถานะ เค้าไม่บังคับแจ้งเตือน)
    res.json({ message: "แก้ไขข้อมูลจัดส่งสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "แก้ข้อมูลจัดส่งไม่สำเร็จ" });
  }
});

router.patch("/orders/:id/delivered", async (req, res) => {
  const { id } = req.params;

  try {
    // ดึง Cid ก่อนเพื่อแจ้งเตือน
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT Cid FROM orders WHERE Oid = ?",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    const customerId = Number(rows[0].Cid);

    await pool.query(
      `UPDATE orders
             SET Ostatus = 'delivered'
             WHERE Oid = ?`,
      [id]
    );

    // แจ้งเตือน delivered
    await safeNotify(pool as unknown as ConnLike, {
      customerId,
      type: "order_delivered",
      title: "จัดส่งสำเร็จ",
      body: `คำสั่งซื้อ #${id} จัดส่งสำเร็จแล้ว`,
      link: `/me/orders/${id}`,
    });

    res.json({ message: "อัปเดตเป็น delivered แล้ว" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "อัปเดตไม่สำเร็จ" });
  }
});

// GET /stats/sales-series
router.get("/stats/sales-series", verifyToken, onlyAdmin, async (req, res) => {
  try {
    const modeRaw = String(req.query.mode || "day");
    const mode: "day" | "month" | "year" = modeRaw === "month" || modeRaw === "year" ? modeRaw : "day";

    const nowYear = new Date().getFullYear();

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const isYMD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

    const toLocalMysql = (d: Date) => {
      const y = d.getFullYear();
      const m = pad2(d.getMonth() + 1);
      const day = pad2(d.getDate());
      const hh = pad2(d.getHours());
      const mm = pad2(d.getMinutes());
      const ss = pad2(d.getSeconds());
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
    };

    const toYear = (x: unknown) => {
      const y = Number(x);
      if (!Number.isFinite(y)) return null;
      const yy = Math.trunc(y);
      if (yy < 2000 || yy > 2100) return null;
      return yy;
    };

    const normYearRange = (ys: number, ye: number) => {
      let a = Math.min(ys, ye);
      let b = Math.max(ys, ye);
      a = Math.max(2000, Math.min(2100, a));
      b = Math.max(2000, Math.min(2100, b));
      return { ys: a, ye: b };
    };

    const addDays = (d: Date, n: number) => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return x;
    };
    const addMonths = (d: Date, n: number) => {
      const x = new Date(d);
      x.setMonth(x.getMonth() + n);
      return x;
    };
    const addYears = (d: Date, n: number) => {
      const x = new Date(d);
      x.setFullYear(x.getFullYear() + n);
      return x;
    };

    const buildKeys = (start: Date, endExclusive: Date) => {
      const keys: string[] = [];

      if (mode === "day") {
        const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
        const end = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate(), 0, 0, 0);
        while (cur < end) {
          keys.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`);
          cur.setDate(cur.getDate() + 1);
        }
        return keys;
      }

      if (mode === "month") {
        const cur = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0);
        const end = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), 1, 0, 0, 0);
        while (cur < end) {
          keys.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`);
          cur.setMonth(cur.getMonth() + 1);
        }
        return keys;
      }

      const curY = start.getFullYear();
      const endY = endExclusive.getFullYear();
      for (let y = curY; y < endY; y++) keys.push(String(y));
      return keys;
    };

    const yearStartQ = toYear(req.query.yearStart);
    const yearEndQ = toYear(req.query.yearEnd);
    const yearQ = toYear(req.query.year);

    const startQ = typeof req.query.start === "string" ? req.query.start.trim() : "";
    const endQ = typeof req.query.end === "string" ? req.query.end.trim() : "";

    let startDate: Date;
    let endDateExclusive: Date;

    let rangeMode: "yearRange" | "singleYear" | "dateRange" | "default" = "default";

    if (yearStartQ != null && yearEndQ != null) {
      const { ys, ye } = normYearRange(yearStartQ, yearEndQ);
      startDate = new Date(`${ys}-01-01T00:00:00`);
      endDateExclusive = new Date(`${ye + 1}-01-01T00:00:00`);
      rangeMode = "yearRange";
    } else if (yearQ != null) {
      startDate = new Date(`${yearQ}-01-01T00:00:00`);
      endDateExclusive = new Date(`${yearQ + 1}-01-01T00:00:00`);
      rangeMode = "singleYear";
    } else if (startQ && endQ && isYMD(startQ) && isYMD(endQ)) {
      startDate = new Date(`${startQ}T00:00:00`);
      const endInclusive = new Date(`${endQ}T00:00:00`);
      endDateExclusive = addDays(endInclusive, 1);
      rangeMode = "dateRange";
    } else {
      const now = new Date();
      if (mode === "day") {
        const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        startDate = addDays(today0, -6);
        endDateExclusive = addDays(today0, 1);
      } else if (mode === "month") {
        const thisMonth0 = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        startDate = addMonths(thisMonth0, -11);
        endDateExclusive = addMonths(thisMonth0, 1);
      } else {
        const thisYear0 = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        startDate = addYears(thisYear0, -4);
        endDateExclusive = addYears(thisYear0, 1);
      }
      rangeMode = "default";
    }

    const startStr = toLocalMysql(startDate);
    const endStr = toLocalMysql(endDateExclusive);

    const keyExprOrders =
      mode === "day"
        ? `DATE_FORMAT(o.Odate, '%Y-%m-%d')`
        : mode === "month"
          ? `DATE_FORMAT(o.Odate, '%Y-%m')`
          : `YEAR(o.Odate)`;

    const keyExprAuction =
      mode === "day"
        ? `DATE_FORMAT(a.end_time, '%Y-%m-%d')`
        : mode === "month"
          ? `DATE_FORMAT(a.end_time, '%Y-%m')`
          : `YEAR(a.end_time)`;

    // รายได้จริง
    const REAL_REVENUE_WHERE = `
      (
        (o.Opayment IN ('bank','transfer','bank_transfer') AND o.Ostatus IN ('paid','shipping','delivered'))
        OR
        (o.Opayment = 'cod' AND o.Ostatus IN ('shipping','delivered'))
      )
    `;

    const [orderRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        ${keyExprOrders} AS k,
        SUM(
          CASE
            WHEN o.Opayment IN ('bank','transfer','bank_transfer')
             AND o.Ostatus IN ('paid','shipping','delivered')
            THEN o.Oprice ELSE 0
          END
        ) AS transfer,
        SUM(
          CASE
            WHEN o.Opayment = 'cod'
             AND o.Ostatus IN ('shipping','delivered')
            THEN o.Oprice ELSE 0
          END
        ) AS cod
      FROM orders o
      WHERE o.Odate >= ? AND o.Odate < ?
      GROUP BY k
      ORDER BY k;
      `,
      [startStr, endStr]
    );

    const [auctionRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        ${keyExprAuction} AS k,
        SUM(
          CASE
            WHEN (a.payment_status = 'paid' OR ap.PROstatus = 'paid')
            THEN a.current_price ELSE 0
          END
        ) AS auction
      FROM auction_products ap
      JOIN auctions a ON a.PROid = ap.PROid
      WHERE a.end_time >= ? AND a.end_time < ?
      GROUP BY k
      ORDER BY k;
      `,
      [startStr, endStr]
    );

    type Row = { k: string; transfer: number; cod: number; auction: number; total: number };
    const map = new Map<string, Row>();
    const toKey = (k: unknown) => String(k);

    const keys = buildKeys(startDate, endDateExclusive);
    for (const k of keys) {
      map.set(k, { k, transfer: 0, cod: 0, auction: 0, total: 0 });
    }

    for (const r of orderRows) {
      const k = toKey(r.k);
      const cur = map.get(k) || { k, transfer: 0, cod: 0, auction: 0, total: 0 };
      cur.transfer = Number(r.transfer || 0);
      cur.cod = Number(r.cod || 0);
      map.set(k, cur);
    }

    for (const r of auctionRows) {
      const k = toKey(r.k);
      const cur = map.get(k) || { k, transfer: 0, cod: 0, auction: 0, total: 0 };
      cur.auction = Number(r.auction || 0);
      map.set(k, cur);
    }

    const toTime = (k: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return new Date(k + "T00:00:00").getTime();
      if (/^\d{4}-\d{2}$/.test(k)) return new Date(k + "-01T00:00:00").getTime();
      if (/^\d{4}$/.test(k)) return new Date(k + "-01-01T00:00:00").getTime();
      return 0;
    };

    const series = Array.from(map.values())
      .sort((a, b) => toTime(a.k) - toTime(b.k))
      .map((x) => ({
        ...x,
        total: x.transfer + x.cod + x.auction,
      }));

    const startOut = startStr.slice(0, 10);
    const endOutInclusive = (() => {
      const endInc = addDays(new Date(endDateExclusive), -1);
      return `${endInc.getFullYear()}-${pad2(endInc.getMonth() + 1)}-${pad2(endInc.getDate())}`;
    })();

    res.json({
      mode,
      rangeMode,
      year: yearQ ?? nowYear,
      yearStart: yearStartQ ?? null,
      yearEnd: yearEndQ ?? null,
      start: startOut,
      end: endOutInclusive,
      series,
    });
  } catch (err) {
    console.error("SALES-SERIES ERROR:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดรายงานยอดขายได้" });
  }
});

router.get("/stats/tasks-overview", verifyToken, onlyAdmin, async (req, res) => {
  const year = parseYear(req.query.year);
  const { start, end } = yearRange(year);

  try {
    const [orderRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        SUM(CASE WHEN Ostatus = 'payment_review' THEN 1 ELSE 0 END) AS paymentReviewOrders,
        SUM(CASE WHEN Opayment = 'cod' AND Ostatus = 'pending_payment' THEN 1 ELSE 0 END) AS codPendingOrders,
        SUM(CASE WHEN Ostatus = 'paid' THEN 1 ELSE 0 END) AS toShipOrders,
        SUM(CASE WHEN Ostatus = 'shipping' THEN 1 ELSE 0 END) AS shippingOrders
      FROM orders
      WHERE Odate >= ? AND Odate < ?
      `,
      [start, end]
    );

    const base = orderRows?.[0] || {
      paymentReviewOrders: 0,
      codPendingOrders: 0,
      toShipOrders: 0,
      shippingOrders: 0,
    };

    let pendingAuctionWinners = 0;

    try {
      const [aucRows] = await pool.query<RowDataPacket[]>(
        `
        SELECT
          COUNT(*) AS pendingAuctionWinners
        FROM auction_products ap
        JOIN auctions a ON a.PROid = ap.PROid
        WHERE a.end_time >= ? AND a.end_time < ?
          AND ap.PROstatus = 'pending_payment'
          AND a.end_time < NOW()
        `,
        [start, end]
      );

      pendingAuctionWinners = Number(aucRows?.[0]?.pendingAuctionWinners || 0);
    } catch (e) {
      pendingAuctionWinners = 0;
    }

    res.json({
      paymentReviewOrders: Number(base.paymentReviewOrders || 0),
      codPendingOrders: Number(base.codPendingOrders || 0),
      toShipOrders: Number(base.toShipOrders || 0),
      shippingOrders: Number(base.shippingOrders || 0),
      pendingAuctionWinners,
    });
  } catch (err) {
    console.error("tasks-overview error:", err);
    res.status(500).json({ message: "ไม่สามารถโหลด tasks overview ได้" });
  }
});

export default router;