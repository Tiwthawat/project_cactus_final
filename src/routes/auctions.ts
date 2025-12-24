// routes/auctions.ts
import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"; // ← ใช้ type จาก mysql2/promise
import { pool } from "../app";
import { verifyToken, type AuthedRequest } from "../middlewares/auth";
import { uploadSlip } from "../middlewares/upload";


const upload = multer({ dest: "uploads/" });



const router = Router();



/** แถวข้อมูลจากตาราง auctions (ไม่รวม join) */
interface AuctionsTableRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  winner_id: number | null;
  PROdetail: string | null;
}



interface AuctionRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
}

interface AuctionProductListRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROpicture: string; // เก็บได้หลายรูปคั่นด้วย ,
  PROprice: number;
  PROstatus: string;
  PROdetail: string | null;

}

// type สำหรับ list สินค้าพร้อมสถานะรอบ
interface AuctionProductListRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROpicture: string;
  PROprice: number;
  PROstatus: string;
  active_aid: number | null;
  active_end_time: Date | null;
  active_current_price: number | null;
  PROdetail: string | null;
}

/** แถวที่ใช้แสดงรายการประมูล (join กับสินค้า) */
interface AuctionListRow extends RowDataPacket {
  Aid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
  PROid: number;
  PROname: string;
  PROpicture: string;
  PROdetail: string | null;
  winnerName: string | null;

}




/** แถวของสินค้าเพื่อประมูล (ถ้าจำเป็นต้องใช้) */
interface AuctionProductRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROprice: number;
  PROstatus: string;
  PROpicture: string;
  PROdetail: string | null;
}

interface AuctionsTableRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  winner_id: number | null;
  PROdetail: string | null;
}
type AuctionStatus = 'open' | 'closed' | 'all';
interface AuctionProductRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROprice: number;
  PROstatus: string;
  PROpicture: string;
  PROdetail: string | null;
  PROrenume: string | null;
  active_aid: number | null;
  active_end_time: Date | null;
  active_current_price: number | null;
}

/** แถวสำหรับหน้า detail (เหมือน list แต่อ่านทีละรายการ) */
interface AuctionDetailRow extends RowDataPacket {
  Aid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
  PROid: number;
  PROname: string;
  PROpicture: string;
  PROdetail: string | null;
  PROstatus: string;
  PROprice: number;
  winner_id: number | null;
  winnerName: string | null;   // ✅ เพิ่มตรงนี้
}


interface BidRow extends RowDataPacket {
  Bidid: number;
  auction_id: number;
  user_id: number;
  amount: number;
  created_at: Date;
}

interface AuctionLeader extends RowDataPacket {
  Cid: number | null;         // ไอดีผู้บิดสูงสุด (ถ้าไม่มี = null)
  Cusername: string | null;   // ชื่อผู้บิดสูงสุด
  amount: number | null;      // จำนวนเงินที่บิดล่าสุด
}


interface AuctionWinnerRow extends RowDataPacket {
  winner_id: number | null;
  current_price: number;
  PROid: number;
}

/** แถวที่ใช้ตรวจสอบผู้ชนะตอนชำระเงิน */
interface AuctionCheckoutRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  winner_id: number | null;
  current_price: number;
  PROstatus: string;
}






export async function autoCloseExpired() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) หา auctions ที่หมดเวลาแล้วและยังเปิดอยู่
    const [expired] = await conn.query<AuctionRow[]>(
      `SELECT a.Aid, a.PROid
       FROM auctions a
       WHERE a.status='open'
         AND a.end_time <= NOW()
       FOR UPDATE`
    );

    // 2) วน loop ทีละรอบ
    for (const auc of expired) {
      // 2.1) หา bid ที่มากที่สุด (ถ้ามี)
      const [bids] = await conn.query<BidRow[]>(
        `SELECT user_id, amount
         FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC, created_at ASC
         LIMIT 1`,
        [auc.Aid]
      );

      if (bids.length === 0) {
        await conn.query<ResultSetHeader>(
          `UPDATE auctions
     SET status='closed', winner_id=NULL, current_price=start_price
     WHERE Aid=?`, [auc.Aid]
        );
        await conn.query<ResultSetHeader>(
          `UPDATE auction_products SET PROstatus='unsold' WHERE PROid=?`, [auc.PROid]
        );
      } else {
        const winnerId = bids[0].user_id;
        const winAmount = bids[0].amount;

        await conn.query<ResultSetHeader>(
          `UPDATE auctions
     SET status='closed', winner_id=?, current_price=?
     WHERE Aid=?`, [winnerId, winAmount, auc.Aid]
        );
        await conn.query<ResultSetHeader>(
          `UPDATE auction_products SET PROstatus='pending_payment' WHERE PROid=?`, [auc.PROid]
        );
      }

    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}



/* =========================
   1) รายการประมูลที่เปิดอยู่
   ========================= */
router.get("/auctions", async (req, res, next) => {
  try {
    await autoCloseExpired();

    const rawStatus = (req.query.status as string) ?? "all";
    const statusFilter: "open" | "closed" | "all" =
      ["open", "closed", "all"].includes(rawStatus) ? (rawStatus as any) : "all";

    const resultFilter = (req.query.result as string) ?? "";
    const payFilter = (req.query.payment_status as string) ?? "";
    const shipFilter = (req.query.shipping_status as string) ?? "";



    let sql = `
      SELECT 
        a.Aid,
        a.start_price,
        a.current_price,
        a.end_time,
        a.status,

        a.payment_status,

        p.PROid,
        p.PROname,
        p.PROpicture,
        p.shipping_status,     -- ⭐ ดึงจากสินค้า ไม่ใช่ auctions

        c.Cusername AS winnerName
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      LEFT JOIN customers c ON a.winner_id = c.Cid
    `;

    const where: string[] = [];
    const params: Array<string | number> = [];

    // ✔ สถานะ open / closed
    if (statusFilter !== "all") {
      where.push("a.status = ?");
      params.push(statusFilter);
    }

    // ✔ filter ผลการประมูล
    if (resultFilter === "won") {
      where.push("a.winner_id IS NOT NULL");
    } else if (resultFilter === "unsold") {
      where.push("a.winner_id IS NULL");
    }

    // ✔ filter การชำระเงิน
    if (payFilter) {
      where.push("a.payment_status = ?");
      params.push(payFilter);
    }
    if (shipFilter) {
      where.push("p.shipping_status = ?");
      params.push(shipFilter);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += " ORDER BY a.end_time DESC";



    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});





/* ===========================================
   2) แอดมินเพิ่มสินค้าเข้าตาราง auction_products (อัปโหลดรูป)
   =========================================== */
router.post(
  "/auction-products",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { PROname, PROprice, PROpicture, PROdetail } = req.body;

      if (!PROname || String(PROname).trim() === "") {
        return res.status(400).json({ error: "ต้องกรอกชื่อสินค้า" });
      }

      const priceNum = Number(PROprice ?? 0);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "ราคาไม่ถูกต้อง" });
      }

      const pictureUrl = PROpicture ?? ""; // ✅ ใช้ค่าที่ส่งมาจาก frontend

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO auction_products (PROname, PROprice, PROstatus, PROpicture, PROdetail)
   VALUES (?, ?, 'ready', ?, ?)`,
        [PROname, priceNum, pictureUrl, PROdetail ?? null]
      );

      res.status(201).json({
        message: "เพิ่มสินค้าเข้าสู่การประมูลสำเร็จ",
        PROid: result.insertId,
        PROpicture: pictureUrl,
      });
    } catch (err) {
      next(err);
    }
  }
);


/* ==========================
   3) แอดมินเปิดรอบประมูลใหม่
   ========================== */
router.post(
  "/auctions",
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { PROid, start_price, end_time, min_increment } = req.body;

      const proIdNum = Number(PROid);
      const startNum = Number(start_price);
      const minIncNum = Number.isInteger(Number(min_increment)) && Number(min_increment) > 0
        ? Number(min_increment)
        : 1;

      if (!proIdNum || Number.isNaN(proIdNum)) {
        return res.status(400).json({ error: "PROid ไม่ถูกต้อง" });
      }
      if (Number.isNaN(startNum) || startNum <= 0) {
        return res.status(400).json({ error: "start_price ต้อง > 0" });
      }
      if (!end_time) {
        return res.status(400).json({ error: "กรุณาระบุ end_time" });
      }
      const end = new Date(end_time);
      if (isNaN(end.getTime()) || end <= new Date()) {
        return res.status(400).json({ error: "end_time ต้องเป็นเวลาอนาคต" });
      }

      await conn.beginTransaction();

      // ✅ ล็อกสินค้า
      const [proRows] = await conn.query<AuctionProductRow[]>(
        `SELECT PROid FROM auction_products WHERE PROid = ? FOR UPDATE`,
        [proIdNum]
      );
      if (proRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบสินค้า" });
      }

      // ✅ ปิดรอบที่หมดเวลา
      await conn.query<ResultSetHeader>(
        `UPDATE auctions SET status='closed' WHERE status='open' AND end_time <= NOW()`
      );

      // ✅ กันเปิดรอบซ้ำ
      const [openRows] = await conn.query<AuctionRow[]>(
        `SELECT Aid FROM auctions WHERE PROid=? AND status='open' LIMIT 1 FOR UPDATE`,
        [proIdNum]
      );
      if (openRows.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "มีรอบที่เปิดอยู่แล้ว" });
      }

      // ✅ เปิดรอบใหม่
      const [ins] = await conn.query<ResultSetHeader>(
        `INSERT INTO auctions (PROid, start_price, current_price, end_time, status, min_increment)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [proIdNum, startNum, startNum, end, minIncNum]
      );

      await conn.query(
        `UPDATE auction_products SET PROstatus='auction' WHERE PROid=?`,
        [proIdNum]
      );

      await conn.commit();
      res.status(201).json({
        ok: true,
        Aid: ins.insertId,
        PROid: proIdNum,
        start_price: startNum,
        current_price: startNum,
        end_time: end.toISOString(),
        status: "open",
        min_increment: minIncNum,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);



/* ======================
   4) ผู้ใช้เสนอราคา (bid)
   ====================== */
router.post(
  "/auctions/:id/bid",
  verifyToken,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const Aid = Number(req.params.id);
      const amount = Number(req.body.amount);
      const u = req.user;
      if (!u || u.role !== "user") {
        conn.release();
        return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });
      }
      const Cid = u.Cid;
      // << เปลี่ยนตรงนี้

      if (!Aid || Number.isNaN(Aid)) {
        return res.status(400).json({ error: "Auction ID ไม่ถูกต้อง" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "จำนวนเงินไม่ถูกต้อง" });
      }

      await conn.beginTransaction();

      const [rows] = await conn.query<AuctionRow[]>(
        `SELECT current_price, status, end_time, min_increment
           FROM auctions
          WHERE Aid = ?
          FOR UPDATE`,
        [Aid]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบรอบประมูล" });
      }

      const { current_price, status, end_time, min_increment } = rows[0];

      if (status !== "open" || new Date(end_time) <= new Date()) {
        await conn.rollback();
        return res.status(400).json({ error: "AUCTION_CLOSED" });
      }

      const requiredMin = Number(current_price) + Math.max(1, Number(min_increment ?? 1));
      if (amount < requiredMin) {
        await conn.rollback();
        return res.status(400).json({ error: "BID_TOO_LOW", requiredMin });
      }

      await conn.query(
        `INSERT INTO bids (auction_id, user_id, amount)
         VALUES (?, ?, ?)`,
        [Aid, Cid, amount]
      );

      await conn.query<ResultSetHeader>(
        `UPDATE auctions
            SET current_price = ?
          WHERE Aid = ?`,
        [amount, Aid]
      );

      await conn.commit();
      return res.json({ ok: true, Aid, new_price: amount });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);








/* ======================
   5) ปิดประมูล
   ====================== */
router.patch("/auctions/:id/close", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();

    const [bids] = await conn.query<BidRow[]>(
      `SELECT user_id, amount
       FROM bids
       WHERE auction_id = ?
       ORDER BY amount DESC, created_at ASC
       LIMIT 1`,
      [id]
    );

    if (bids.length === 0) {
      await conn.query<ResultSetHeader>(
        `UPDATE auctions
         SET status='closed', winner_id=NULL, current_price=start_price
         WHERE Aid=?`,
        [id]
      );
      await conn.query<ResultSetHeader>(
        `UPDATE auction_products ap
         JOIN auctions a ON a.PROid = ap.PROid
         SET ap.PROstatus = 'ready'
         WHERE a.Aid = ?`,
        [id]
      );
      await conn.commit();
      return res.json({ message: "ปิดประมูลแล้ว (ไม่มีผู้ชนะ)" });
    }

    const winnerId = bids[0].user_id;
    const winAmount = bids[0].amount;

    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE auctions
       SET status='closed', winner_id=?, current_price=?
       WHERE Aid=?`,
      [winnerId, winAmount, id]
    );

    await conn.query<ResultSetHeader>(
      `UPDATE auction_products ap
       JOIN auctions a ON a.PROid = ap.PROid
       SET ap.PROstatus = 'pending_payment'
       WHERE a.Aid = ?`,
      [id]
    );

    await conn.commit();
    if (result.affectedRows === 0) return res.status(409).json({ error: "ปิดประมูลไม่สำเร็จ" });
    res.json({ message: "ปิดประมูลแล้ว", winnerId, winAmount });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});





/* ===========================
   6) รายละเอียดประมูล (1 รายการ)
   =========================== */
router.get(
  "/auction/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      //console.log("👉 Auction id =", id);
      await autoCloseExpired();

      const [rows] = await pool.query<AuctionDetailRow[]>(
        `
        SELECT 
          a.Aid, 
          a.start_price, 
          a.current_price,
          a.current_price AS close_price,
          a.end_time, 
          a.status,
          a.min_increment, 
          a.winner_id,
          a.payment_status,

          p.PROid, 
          p.PROname, 
          p.PROpicture, 
          p.PROdetail, 
          p.PROstatus, 
          p.PROprice,
          p.shipping_company,
          p.tracking_number,
          p.shipping_status,

          c.Cusername AS winnerName
        FROM auctions a
        JOIN auction_products p ON a.PROid = p.PROid
        LEFT JOIN customers c ON a.winner_id = c.Cid
        WHERE a.Aid = ?
        LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "ไม่พบรายการประมูล" });
      }

      const auc = rows[0];

      res.json({
        ...auc,
        winnerName: auc.winnerName ?? ""
      });

    } catch (err) {
      console.error("❌ GET /auction/:id error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);







router.get("/auction-products", async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) ?? "all";
    const q = (req.query.q as string | undefined)?.trim();

    const available =
      Object.prototype.hasOwnProperty.call(req.query, "available") &&
      String(req.query.available).toLowerCase() !== "0" &&
      String(req.query.available).toLowerCase() !== "false";

    let sql = `
      SELECT 
        p.PROid, 
        p.PROname, 
        p.PROpicture, 
        p.PROprice, 
        p.PROstatus, 
        p.PROdetail,

        -- ⭐ เอารอบล่าสุดเสมอ ไม่ว่าจะ open หรือปิดแล้ว
        a.Aid AS active_aid,
        a.end_time AS active_end_time,
        a.current_price AS active_current_price
      FROM auction_products p
      LEFT JOIN auctions a 
        ON a.Aid = (
          SELECT Aid 
          FROM auctions 
          WHERE PROid = p.PROid
          ORDER BY end_time DESC
          LIMIT 1
        )
    `;

    const params: Array<string | number> = [];
    const where: string[] = [];

    if (status !== "all") {
      where.push("p.PROstatus = ?");
      params.push(status);
    }

    if (q) {
      where.push("(p.PROname LIKE ?)");
      params.push(`%${q}%`);
    }

    if (available) {
      where.push(`
        NOT EXISTS (
          SELECT 1 FROM auctions ax
          WHERE ax.PROid = p.PROid AND ax.status = 'open'
        )
      `);
    }

    if (where.length) sql += ` WHERE ${where.join(" AND ")}`;

    sql += ` ORDER BY p.PROid DESC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});



// ✅ ลบสินค้าออกจากตาราง auction_products
router.delete(
  "/auction-products/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM auction_products WHERE PROid = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "ไม่พบสินค้าที่ต้องการลบ" });
      }

      res.json({ message: "ลบสินค้าออกจากการประมูลสำเร็จ" });
    } catch (err) {
      next(err);
    }
  }
);


router.delete(
  "/auctions/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { id } = req.params;

      await conn.beginTransaction();

      // ล็อกแถว เพื่อกันชนแข่งกันลบ/บิด
      const [rows] = await conn.query<AuctionsTableRow[]>(
        `SELECT Aid, start_price, current_price, status
           FROM auctions
          WHERE Aid = ?
          FOR UPDATE`,
        [id]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบรอบประมูล" });
      }

      const a = rows[0];

      // ห้ามลบถ้ามีการบิดแล้ว
      if (a.current_price > a.start_price) {
        await conn.rollback();
        return res.status(400).json({ error: "ลบไม่ได้: รอบนี้มีคนบิดแล้ว" });
      }

      // (แนะนำ) ให้ลบได้เฉพาะรอบที่ยัง open เพื่อเก็บประวัติรอบที่ปิดแล้ว
      if (a.status !== "open") {
        await conn.rollback();
        return res.status(400).json({ error: "ลบได้เฉพาะรอบที่ยังเปิดอยู่" });
      }

      const [result] = await conn.query<ResultSetHeader>(
        `DELETE FROM auctions WHERE Aid = ?`,
        [id]
      );

      await conn.commit();

      if (result.affectedRows === 0) {
        return res.status(409).json({ error: "ลบไม่สำเร็จ" });
      }

      res.json({ message: "ลบสำเร็จ" });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);



// ดึงสินค้า 1 รายการ + รอบที่เปิด (ถ้ามี)
router.get(
  "/auction-products/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: "id ไม่ถูกต้อง" });

      const sql = `
        SELECT 
          p.PROid, p.PROname, p.PROprice, p.PROstatus, p.PROpicture,
          p.PROdetail, p.PROrenume,
          a.Aid AS active_aid, a.end_time AS active_end_time, a.current_price AS active_current_price
        FROM auction_products p
        LEFT JOIN auctions a
               ON a.PROid = p.PROid AND a.status = 'open'
        WHERE p.PROid = ?
        LIMIT 1
      `;
      const [rows] = await pool.query<AuctionProductRow[]>(sql, [id]);
      if (rows.length === 0) return res.status(404).json({ error: "ไม่พบสินค้า" });
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// routes/auction.ts
router.get("/auction/:id/leader", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<AuctionLeader[]>(
      `
      SELECT 
        b.user_id, 
        c.Cusername AS username, 
        b.amount, 
        b.created_at
      FROM bids b
      JOIN customers c ON b.user_id = c.Cid
      WHERE b.auction_id = ?
      ORDER BY b.amount DESC, b.created_at DESC
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.json({ leader: null });
    }

    res.json({
      leader: {
        user_id: rows[0].user_id,
        username: rows[0].username,
        amount: rows[0].amount,
        created_at: rows[0].created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});


router.post(
  "/auction/:id/pay",
  upload.single("slip"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const Aid = Number(req.params.id);
      const userId = Number(req.body.user_id);
      const file = req.file;

      if (!Aid || !userId || !file) {
        return res.status(400).json({ error: "ข้อมูลไม่ครบ" });
      }

      // 1) ตรวจว่าผู้ใช้นี้เป็นผู้ชนะจริงไหม
      const [rows] = await pool.query<AuctionWinnerRow[]>(
        `
        SELECT winner_id, current_price, PROid
        FROM auctions
        WHERE Aid=?
        LIMIT 1
        `,
        [Aid]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "ไม่พบรอบประมูลนี้" });
      }

      const auc = rows[0];

      if (auc.winner_id !== userId) {
        return res.status(403).json({ error: "คุณไม่ใช่ผู้ชนะของรอบนี้" });
      }

      // 2) เก็บข้อมูลการชำระเงินลง DB
      const slipPath = "/uploads/" + file.filename;

      await pool.query(
        `
        INSERT INTO auction_payments (Aid, PROid, winner_id, amount, slip)
        VALUES (?, ?, ?, ?, ?)
        `,
        [Aid, auc.PROid, userId, auc.current_price, slipPath]
      );

      // 3) อัปเดตสถานะสินค้า = paid
      await pool.query(
        `
        UPDATE auction_products
        SET PROstatus='paid'
        WHERE PROid=?
        `,
        [auc.PROid]
      );

      return res.json({
        ok: true,
        slip: slipPath
      });
    } catch (err) {
      next(err);
    }
  }
);


router.post(
  "/auction-checkout",
  verifyToken,
  uploadSlip.single("slip"),
  async (req: AuthedRequest, res: Response) => {
    const conn = await pool.getConnection();
    try {
      const { Aid } = req.body;
      const u = req.user;
      if (!u || u.role !== "user") {
        conn.release();
        return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });
      }
      const Cid = u.Cid;


      const slip = req.file;

      if (!Aid) {
        conn.release();
        return res.status(400).json({ message: "ไม่มี Aid ในคำขอ" });
      }

      if (!slip) {
        conn.release();
        return res.status(400).json({ message: "กรุณาอัปโหลดสลิป" });
      }

      const [rows] = await conn.query<AuctionCheckoutRow[]>(`
        SELECT a.Aid, a.PROid, a.winner_id, a.current_price, p.PROstatus
        FROM auctions a
        JOIN auction_products p ON a.PROid = p.PROid
        WHERE a.Aid = ?
      `, [Aid]);

      if (rows.length === 0) {
        conn.release();
        return res.status(404).json({ message: "ไม่พบรายการประมูลนี้" });
      }

      const auc = rows[0];

      if (auc.winner_id !== Cid) {
        conn.release();
        return res.status(403).json({ message: "ไม่ได้เป็นผู้ชนะรายการนี้" });
      }

      if (auc.PROstatus !== "pending_payment") {
        conn.release();
        return res.status(400).json({ message: "รายการนี้ชำระเงินแล้ว หรือสถานะไม่ถูกต้อง" });
      }

      // INSERT payment
      await conn.query(`
        INSERT INTO auction_payments 
        (Aid, PROid, winner_id, amount, slip, paid_at, status)
        VALUES (?, ?, ?, ?, ?, NOW(), 'payment_review')
      `, [Aid, auc.PROid, Cid, auc.current_price, "/slips/" + slip.filename]);

      await conn.query(`
        UPDATE auction_products 
        SET PROstatus = 'payment_review'
        WHERE PROid = ?
      `, [auc.PROid]);

      conn.release();
      return res.json({ message: "อัปโหลดสลิปสำเร็จ รอแอดมินตรวจสอบ" });

    } catch (err: any) {
      conn.release(); // ต้องเพิ่มตรงนี้
      console.error("❌ /auction-checkout error:", err);
      return res.status(500).json({
        message: "เกิดข้อผิดพลาด",
        detail: err?.message,
      });
    }
  }
);









export default router;
