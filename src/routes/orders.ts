import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";
import { verifyToken } from "../middlewares/auth";
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

router.put('/orders/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Ostatus } = req.body;

    if (!Ostatus) {
        return res.status(400).json({ message: "ต้องระบุ Ostatus" });
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1) ดึงข้อมูลคำสั่งซื้อก่อน (เช็กว่า COD ไหม)
        const [orders] = await conn.query<RowDataPacket[]>(
            `SELECT Opayment, Ostatus FROM orders WHERE Oid = ?`,
            [id]
        );
        const order = orders[0];

        // 2) ดึงรายการสินค้าในออเดอร์
        const [items] = await conn.query<RowDataPacket[]>(
            `SELECT Pid, Oquantity 
             FROM order_items 
             WHERE Oid = ?`,
            [id]
        );

        // ⭐ CASE 1: ชำระเงินสำเร็จ (paid) → ลดสต๊อกทันที
        if (Ostatus === 'paid') {
            for (const item of items) {
                await conn.query(
                    `UPDATE products
                     SET 
                       Pnumproduct = Pnumproduct - ?,
                       Prenume = COALESCE(Prenume,0) + ?
                     WHERE Pid = ?`,
                    [item.Oquantity, item.Oquantity, item.Pid]
                );
            }
        }

        // ⭐ CASE 2: shipped สำหรับ COD → ลดสต๊อกตอนส่งของ
        if (Ostatus === 'shipped' && order.Opayment === 'cod') {
            for (const item of items) {
                await conn.query(
                    `UPDATE products
                     SET 
                       Pnumproduct = Pnumproduct - ?,
                       Prenume = COALESCE(Prenume,0) + ?
                     WHERE Pid = ?`,
                    [item.Oquantity, item.Oquantity, item.Pid]
                );
            }
        }

        // ⭐ CASE 3 (optional): ถ้าอยากคืนสต๊อกเวลากดยกเลิก ให้บอกเค้าเพิ่ม

        // 3) อัปเดตสถานะคำสั่งซื้อ
        await conn.query(
            `UPDATE orders SET Ostatus = ? WHERE Oid = ?`,
            [Ostatus, id]
        );

        await conn.commit();
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });

    } catch (err) {
        await conn.rollback();
        console.error("❌ UPDATE Ostatus ERROR:", err);
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

    // ✅ เพิ่ม filter แบบ dashboard
    const type = String(req.query.type || "all");
    const isLatestNew = type === "latest_new";

    const connection = await pool.getConnection();
    try {
        const where: string[] = ["o.Odate >= ? AND o.Odate < ?"];
        const params: any[] = [start, end];

        if (isLatestNew) {
            // ✅ ออเดอร์ใหม่/งานที่ยังต้องทำ (ไม่เอา delivered/cancelled/failed)
            where.push(`o.Ostatus IN ('pending_payment','payment_review','paid')`);
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
        console.error("❌ ADMIN GET ALL ORDERS ERROR:", err);
        res.status(500).json({ message: "ไม่สามารถโหลดคำสั่งซื้อได้" });
    } finally {
        connection.release();
    }
});




router.post("/orders", async (req, res, next) => {
    const { Cid, items, payment, totalPrice } = req.body;

    if (!Cid || !Array.isArray(items) || items.length === 0 || totalPrice === undefined) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }

    const conn = await pool.getConnection();
    try {

        // ⭐ 1) เช็กสต๊อกก่อนสร้างออเดอร์
        for (const item of items) {
            const [rows] = await conn.query<RowDataPacket[]>(
                "SELECT Pnumproduct FROM products WHERE Pid = ?",
                [item.Pid]
            );

            if (rows.length === 0) {
                conn.release();
                return res.status(404).json({ message: "ไม่พบสินค้า", Pid: item.Pid });
            }

            const stock = rows[0].Pnumproduct;

            if (stock < item.quantity) {
                conn.release();
                return res.status(400).json({
                    message: "สินค้าในคลังไม่พอ",
                    Pid: item.Pid,
                    available: stock
                });
            }
        }

        // ⭐ 2) สร้างออเดอร์ (ยังไม่ลดสต๊อกจนกว่าจะ paid)
        await conn.beginTransaction();

        const [orderResult] = await conn.query<ResultSetHeader>(
            "INSERT INTO orders (Cid, Oprice, Odate, Ostatus, Opayment) VALUES (?, ?, NOW(), ?, ?)",
            [Cid, totalPrice, "pending_payment", payment]
        );

        const Oid = orderResult.insertId;

        for (const item of items) {
            await conn.query(
                "INSERT INTO order_items (Oid, Pid, Oquantity, Oprice) VALUES (?, ?, ?, ?)",
                [Oid, item.Pid, item.quantity, item.price]
            );
        }

        await conn.commit();

        res.status(200).json({
            message: "สร้างคำสั่งซื้อสำเร็จ",
            orderId: Oid
        });

    } catch (error) {
        await conn.rollback();
        next(error);
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
        interface Order extends RowDataPacket {
            Oid: number;
            Cid: number;
            Oprice: number;
            Odate: string;
            Ostatus: string;
        }

        const [orders] = await connection.query<Order[]>(
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
                items: items.filter((item) => item.Oid === order.Oid)
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


router.patch("/orders/:id/slip", async (req, res, next) => {
    const { id } = req.params;
    const { slipUrl } = req.body;

    try {
        // 🔍 ดึงวิธีการชำระเงินก่อน
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT Opayment FROM orders WHERE Oid = ?`,
            [id]
        );
        const order = rows[0];

        if (order.Opayment === 'cod') {
            return res.status(400).json({ message: "คำสั่งซื้อแบบเก็บเงินปลายทาง ไม่ต้องแนบสลิป" });
        }

        // ✅ แนบสลิปตามปกติ
        await pool.query(`UPDATE orders SET Oslip = ?, Ostatus = 'waiting' WHERE Oid = ?`, [slipUrl, id]);
        res.json({ message: "บันทึกสลิปสำเร็จ" });
    } catch (err) {
        next(err);
    }
});


router.patch('/orders/:id/cancel', async (req, res, next) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE orders SET Ostatus = 'cancelled' WHERE Oid = ?`, [id]);
        res.json({ message: 'ยกเลิกคำสั่งซื้อแล้ว' });
    } catch (err) {
        next(err);
    }
});


router.get('/orders/customer/:id', async (req, res, next) => {
    try {
        const connection = await pool.getConnection()
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


            res.json([...rows])
        } catch (error) {
            next(error)
        } finally {
            connection.release()
        }
    } catch (error) {
        next(error)
    }
})

// GET /orders/stats
router.get('/stats', async (req, res) => {
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
        console.log('📊 สถิติ:', rows);
        res.json(rows[0]);

    } catch (err) {
        console.error('Error loading stats:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดสถิติได้' });
    }
});

router.patch('/orders/:id/confirm', async (req, res, next) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query<ResultSetHeader>(
                `UPDATE orders SET Ostatus = 'delivered' WHERE Oid = ? AND Ostatus = 'shipped'`,
                [req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(400).json({ message: 'ไม่สามารถยืนยันได้ (สถานะไม่ใช่ shipped)' });
            }

            res.json({ message: 'ยืนยันรับสินค้าเรียบร้อยแล้ว' });
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
router.get('/orders/:id/review', async (req, res) => {
    const orderId = req.params.id;
    try {
        const [rows] = await pool.query<ReviewRow[]>(
            'SELECT * FROM reviews WHERE order_id = ?',
            [orderId]
        );
        res.json(rows[0] || null); // ส่ง null ถ้ายังไม่มี
    } catch (err) {
        console.error('Error fetching review:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดรีวิวได้' });
    }
});


router.post('/orders/:id/review', async (req, res) => {
    const { text, stars } = req.body;
    const orderId = req.params.id;

    try {
        // ❗ เช็กก่อนว่ามีอยู่แล้วหรือยัง
        const [existing] = await pool.query<ReviewRow[]>(
            'SELECT * FROM reviews WHERE order_id = ?',
            [orderId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'รีวิวนี้ถูกส่งไปแล้ว' });
        }

        // ✅ ยังไม่มี → สร้างรีวิวใหม่
        await pool.query(
            'INSERT INTO reviews (text, stars, order_id) VALUES (?, ?, ?)',
            [text, stars, orderId]
        );

        res.status(201).json({ message: 'Review created' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating review' });
    }
});


router.patch('/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // ดึงสถานะเดิม
        const [orderRows] = await conn.query<RowDataPacket[]>(
            "SELECT Ostatus FROM orders WHERE Oid = ?",
            [id]
        );

        if (orderRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'ไม่พบคำสั่งซื้อ' });
        }

        const oldStatus = String(orderRows[0].Ostatus);

        // อัปเดตสถานะใหม่
        await conn.query(
            "UPDATE orders SET Ostatus = ? WHERE Oid = ?",
            [status, id]
        );

        // ⭐ ลดสต๊อกครั้งแรกตอน paid
        if (oldStatus !== "paid" && status === "paid") {
            const [items] = await conn.query<RowDataPacket[]>(
                "SELECT Pid, Oquantity FROM order_items WHERE Oid = ?",
                [id]
            );

            for (const item of items) {
                // ลด Pnumproduct และเพิ่ม Prenume
                await conn.query(
                    "UPDATE products SET Pnumproduct = Pnumproduct - ?, Prenume = Prenume + ? WHERE Pid = ?",
                    [item.Oquantity, item.Oquantity, item.Pid]
                );
            }
        }

        // ⭐ คืนสต๊อกถ้า old = paid แล้ว -> cancelled
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






// GET /stats/full — รวมข้อมูลทั้งหมดของร้าน (optional ?year=YYYY)
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
            console.error(`⚠️ STATS SKIP @ ${name}:`, e);
            return [] as unknown as T;
        }
    };

    // ---------- optional year ----------
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

    // helper: date filter
    const orderDateFilter = hasYear ? `WHERE Odate >= ? AND Odate < ?` : ``;
    const orderDateParams = hasYear ? [start, end] : [];

    const auctionDateFilter = hasYear ? `WHERE a.end_time >= ? AND a.end_time < ?` : ``;
    const auctionDateParams = hasYear ? [start, end] : [];

    try {
        /* ---------------- 1) Orders (ขายปกติ) ---------------- */
        const [orderStats] = await pool.query<RowDataPacket[]>(
            `
      SELECT
        COUNT(*) AS totalOrders,

        SUM(
          CASE 
            WHEN (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid')
              OR (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
            THEN Oprice ELSE 0 END
        ) AS orderSales,

        SUM(CASE WHEN Ostatus = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
        SUM(CASE WHEN Ostatus = 'failed' THEN 1 ELSE 0 END) AS failedOrders,

        SUM(
          CASE 
            WHEN DATE(Odate) = CURDATE()
              AND (
                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid') 
                OR (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
              )
            THEN Oprice ELSE 0 END
        ) AS orderToday,

        SUM(
          CASE 
            WHEN MONTH(Odate) = MONTH(CURDATE())
              AND YEAR(Odate) = YEAR(CURDATE())
              AND (
                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid') 
                OR (Opayment = 'cod' AND Ostatus IN ('shipping','delivered'))
              )
            THEN Oprice ELSE 0 END
        ) AS orderMonth,

        SUM(
          CASE 
            WHEN Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid'
            THEN Oprice ELSE 0 END
        ) AS bankSales,

        SUM(
          CASE 
            WHEN Opayment = 'cod' AND Ostatus IN ('shipping','delivered')
            THEN Oprice ELSE 0 END
        ) AS codSales

      FROM orders
      ${orderDateFilter}
      `,
            orderDateParams
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
      ${auctionDateFilter}
      `,
            auctionDateParams
        );

        /* ---------------- 3) Reports ---------------- */

        // A) Order status overview
        const orderStatusOverview = await safe<RowDataPacket[]>(
            "orderStatusOverview",
            `
      SELECT Ostatus AS status, COUNT(*) AS count
      FROM orders
      ${orderDateFilter}
      GROUP BY Ostatus
      ORDER BY COUNT(*) DESC
      `,
            orderDateParams
        );

        // B) Top products
        const topProducts = await safe<RowDataPacket[]>(
            "topProducts",
            `
      SELECT
        p.Pid AS product_id,
        p.Pname AS name,
        '-' AS category,
        SUM(oi.Oquantity) AS qty,
        SUM(oi.Oquantity * oi.Oprice) AS revenue
      FROM order_items oi
      JOIN orders o ON o.Oid = oi.Oid
      JOIN products p ON p.Pid = oi.Pid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""
            }
        (
          (o.Opayment IN ('bank','transfer','bank_transfer') AND o.Ostatus = 'paid')
          OR
          (o.Opayment = 'cod' AND o.Ostatus IN ('shipping','delivered'))
        )
      GROUP BY p.Pid, p.Pname
      ORDER BY revenue DESC
      LIMIT 10
      `,
            hasYear ? [start, end] : []
        );

        // C) Category revenue (รวม)
        const categoryRevenue = await safe<RowDataPacket[]>(
            "categoryRevenue",
            `
      SELECT
        'ทั้งหมด' AS category,
        SUM(oi.Oquantity) AS qty,
        SUM(oi.Oquantity * oi.Oprice) AS revenue
      FROM order_items oi
      JOIN orders o ON o.Oid = oi.Oid
      WHERE
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""
            }
        (
          (o.Opayment IN ('bank','transfer','bank_transfer') AND o.Ostatus = 'paid')
          OR
          (o.Opayment = 'cod' AND o.Ostatus IN ('shipping','delivered'))
        )
      `,
            hasYear ? [start, end] : []
        );

        // D) Stock (current state)
        const LOW_STOCK_THRESHOLD = 5;

        const stockByCategory = await safe<RowDataPacket[]>(
            "stockByCategory",
            `
      SELECT
        'ทั้งหมด' AS category,
        COUNT(Pid) AS total_products,
        SUM(Pnumproduct) AS total_stock,
        SUM(CASE WHEN Pnumproduct <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS low_stock
      FROM products
      `
        );

        const lowStockProducts = await safe<RowDataPacket[]>(
            "lowStockProducts",
            `
      SELECT
        Pid AS product_id,
        Pname AS name,
        '-' AS category,
        Pnumproduct AS stock
      FROM products
      WHERE Pnumproduct <= ${LOW_STOCK_THRESHOLD}
      ORDER BY Pnumproduct ASC
      LIMIT 12
      `
        );

        // E) Top customers
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
        ${hasYear ? "o.Odate >= ? AND o.Odate < ? AND" : ""
            }
        (
          (o.Opayment IN ('bank','transfer','bank_transfer') AND o.Ostatus = 'paid')
          OR
          (o.Opayment = 'cod' AND o.Ostatus IN ('shipping','delivered'))
        )
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
          SELECT a.Aid, COUNT(b.id) AS cnt
          FROM auctions a
          LEFT JOIN bids b ON b.Aid = a.Aid
          ${auctionDateFilter}
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
        } catch { }

        /* ---------------- 5) Total ---------------- */
        const totalSales =
            Number(orderStats?.[0]?.orderSales || 0) +
            Number(auctionStats?.[0]?.auctionSales || 0);

        res.json({
            year,
            range: hasYear ? { start, end } : null,

            ...orderStats[0],
            ...auctionStats[0],
            totalSales,

            orderStatusOverview,
            topProducts,
            categoryRevenue,
            stockByCategory,
            lowStockProducts,
            topCustomers,

            auctionParticipationAvg,
            auctionClosedRate,
        });
    } catch (err) {
        console.error("🔥 STATS ERROR:", err);
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
        await pool.query(
            `UPDATE orders 
             SET Oshipping = ?, Otracking = ?, Ostatus = 'shipping'
             WHERE Oid = ?`,
            [Oshipping, Otracking, id]
        );

        res.json({ message: "อัปเดตข้อมูลจัดส่งสำเร็จ" });
    } catch (err) {
        console.error("❌ SHIPPING UPDATE ERROR:", err);
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

        res.json({ message: "แก้ไขข้อมูลจัดส่งสำเร็จ" });
    } catch (err) {
        res.status(500).json({ message: "แก้ข้อมูลจัดส่งไม่สำเร็จ" });
    }
});

router.patch("/orders/:id/delivered", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(
            `UPDATE orders 
             SET Ostatus = 'delivered'
             WHERE Oid = ?`,
            [id]
        );

        res.json({ message: "อัปเดตเป็น delivered แล้ว" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "อัปเดตไม่สำเร็จ" });
    }
});

// GET /stats/sales-series?mode=day|month|year&year=2026
// (ยังรองรับ start/end แบบเดิมด้วย ถ้าไม่ส่ง year)
router.get('/stats/sales-series', verifyToken, onlyAdmin, async (req, res) => {
    try {
        const modeRaw = String(req.query.mode || 'day');
        const mode: 'day' | 'month' | 'year' =
            modeRaw === 'month' || modeRaw === 'year' ? modeRaw : 'day';

        // ----- year support -----
        const nowYear = new Date().getFullYear();
        const yearQ = req.query.year;
        const yearNum = Number(yearQ);

        const hasYear =
            typeof yearQ !== 'undefined' &&
            Number.isFinite(yearNum) &&
            yearNum >= 2000 &&
            yearNum <= 2100;

        const startQ = typeof req.query.start === 'string' ? req.query.start : '';
        const endQ = typeof req.query.end === 'string' ? req.query.end : '';

        let startDate: Date;
        let endDate: Date;

        if (hasYear) {
            // ปีที่เลือก: [ปี-01-01, ปี+1-01-01)
            startDate = new Date(`${yearNum}-01-01T00:00:00`);
            endDate = new Date(`${yearNum + 1}-01-01T00:00:00`);
        } else {
            // ----- เดิม: start/end หรือ default range -----
            const now = new Date();
            endDate = endQ ? new Date(endQ + 'T23:59:59') : now;

            if (startQ) {
                startDate = new Date(startQ + 'T00:00:00');
            } else {
                startDate = new Date(endDate);
                if (mode === 'day') startDate.setDate(startDate.getDate() - 6);
                if (mode === 'month') startDate.setMonth(startDate.getMonth() - 11);
                if (mode === 'year') startDate.setFullYear(startDate.getFullYear() - 4);
            }
        }

        // MySQL DATETIME strings
        const startStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
        const endStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

        // group key ตาม mode
        const keyExprOrders =
            mode === 'day'
                ? `DATE_FORMAT(Odate, '%Y-%m-%d')`
                : mode === 'month'
                    ? `DATE_FORMAT(Odate, '%Y-%m')`
                    : `YEAR(Odate)`;

        const keyExprAuction =
            mode === 'day'
                ? `DATE_FORMAT(a.end_time, '%Y-%m-%d')`
                : mode === 'month'
                    ? `DATE_FORMAT(a.end_time, '%Y-%m')`
                    : `YEAR(a.end_time)`;


        // ------- orders series (transfer/cod) -------
        const [orderRows] = await pool.query<RowDataPacket[]>(
            `
      SELECT
        ${keyExprOrders} AS k,
        SUM(
          CASE
            WHEN Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid'
            THEN Oprice ELSE 0 END
        ) AS transfer,
        SUM(
          CASE
            WHEN Opayment = 'cod' AND Ostatus IN ('shipping','delivered')
            THEN Oprice ELSE 0 END
        ) AS cod
      FROM orders
      WHERE Odate >= ? AND Odate < ?
      GROUP BY k
      ORDER BY k;
      `,
            [startStr, endStr]
        );

        // ------- auction series (auction) -------
        const [auctionRows] = await pool.query<RowDataPacket[]>(
            `
      SELECT
        ${keyExprAuction} AS k,
        SUM(CASE WHEN ap.PROstatus = 'paid' THEN a.current_price ELSE 0 END) AS auction
      FROM auction_products ap
      JOIN auctions a ON a.PROid = ap.PROid
      WHERE a.end_time >= ? AND a.end_time < ?
      GROUP BY k
      ORDER BY k;
      `,
            [startStr, endStr]
        );

        // ------- merge result -------
        type Row = { k: string; transfer: number; cod: number; auction: number; total: number };
        const map = new Map<string, Row>();
        const toKey = (k: unknown) => String(k);

        for (const r of orderRows) {
            const k = toKey(r.k);
            map.set(k, {
                k,
                transfer: Number(r.transfer || 0),
                cod: Number(r.cod || 0),
                auction: 0,
                total: 0,
            });
        }

        for (const r of auctionRows) {
            const k = toKey(r.k);
            const cur = map.get(k) || { k, transfer: 0, cod: 0, auction: 0, total: 0 };
            cur.auction = Number(r.auction || 0);
            map.set(k, cur);
        }

        const toTime = (k: string) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return new Date(k + 'T00:00:00').getTime();
            if (/^\d{4}-\d{2}$/.test(k)) return new Date(k + '-01T00:00:00').getTime();
            if (/^\d{4}$/.test(k)) return new Date(k + '-01-01T00:00:00').getTime();
            return 0;
        };

        const series = Array.from(map.values())
            .sort((a, b) => toTime(String(a.k)) - toTime(String(b.k)))
            .map((x) => ({
                ...x,
                total: x.transfer + x.cod + x.auction,
            }));


        res.json({
            mode,
            year: hasYear ? yearNum : nowYear,
            start: startStr.slice(0, 10),
            end: endStr.slice(0, 10),
            series,
        });
    } catch (err) {
        console.error('🔥 SALES-SERIES ERROR:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดรายงานยอดขายได้' });
    }
});


// GET /stats/pending — งานค้างของแอดมิน
router.get('/stats/pending', verifyToken, onlyAdmin, async (req, res) => {
    try {
        const hasYear = typeof req.query.year !== "undefined";
        let start = "";
        let end = "";
        let orderDateFilter = "";
        let orderParams: any[] = [];
        let auctionDateFilter = "";
        let auctionParams: any[] = [];

        if (hasYear) {
            const year = parseYear(req.query.year);
            const r = yearRange(year);
            start = r.start;
            end = r.end;

            orderDateFilter = ` AND Odate >= ? AND Odate < ?`;
            orderParams = [start, end];

            // ถ้าประมูลมี end_time ในตาราง auctions
            auctionDateFilter = ` AND a.end_time >= ? AND a.end_time < ?`;
            auctionParams = [start, end];
        }

        // 1) รอตรวจสอบการชำระเงิน
        const [prRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS n
      FROM orders
      WHERE Ostatus IN ('payment_review','waiting')
      ${orderDateFilter}
    `, orderParams);

        // 2) รอจัดส่ง (จ่ายแล้ว)
        const [shipRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS n
      FROM orders
      WHERE Ostatus = 'paid'
      ${orderDateFilter}
    `, orderParams);

        // 3) ผู้ชนะประมูลรอชำระ
        // ถ้าไม่มีตาราง auctions / ไม่มี end_time ให้ตัด filter ออกก่อน
        const [awRows] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS n
      FROM auction_products ap
      JOIN auctions a ON a.PROid = ap.PROid
      WHERE ap.PROstatus = 'pending_payment'
      ${auctionDateFilter}
    `, auctionParams);

        res.json({
            paymentReviewOrders: Number(prRows[0]?.n || 0),
            toShipOrders: Number(shipRows[0]?.n || 0),
            pendingAuctionWinners: Number(awRows[0]?.n || 0),
        });
    } catch (err) {
        console.error('🔥 PENDING ERROR:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดงานที่รอดำเนินการได้' });
    }
});



















export default router;
