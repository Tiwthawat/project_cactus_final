// routes/auctions.ts
import { NextFunction, Request, Response, Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"; // ← ใช้ type จาก mysql2/promise
import { pool } from "../app";

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
}

/** แถวสำหรับหน้า detail (เหมือน list แต่อ่านทีละรายการ) */
type AuctionDetailRow = AuctionListRow;


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




async function autoCloseExpired() {
  // ถ้าแน่ใจว่าเวลาตรงกับเซิร์ฟเวอร์แล้ว ใช้ NOW() ได้
  await pool.query(`
    UPDATE auctions
       SET status = 'closed'
     WHERE status = 'open'
       AND end_time <= NOW()
  `);
}

/* =========================
   1) รายการประมูลที่เปิดอยู่
   ========================= */
router.get(
  "/auctions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await autoCloseExpired();

      const raw = (req.query.status as string | undefined) ?? "all";
      const status: AuctionStatus = ['open', 'closed', 'all'].includes(raw as any)
        ? (raw as AuctionStatus)
        : 'all';

      let sql = `
        SELECT a.Aid, a.start_price, a.current_price, a.end_time, a.status,
               p.PROid, p.PROname, p.PROpicture
          FROM auctions a
          JOIN auction_products p ON a.PROid = p.PROid
      `;
      const params: Array<string | number> = [];

      if (status !== "all") {
        sql += " WHERE a.status = ?";
        params.push(status);
      }

      sql += " ORDER BY a.end_time DESC";

      // กัน cache เก็บผลลัพธ์เก่า
      res.setHeader('Cache-Control', 'no-store');

      const [rows] = await pool.query<AuctionListRow[]>(sql, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);


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
   VALUES (?, ?, 'auction', ?, ?)`,
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
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const Aid = Number(req.params.id);
      const amount = Number(req.body.amount);

      if (!Aid || Number.isNaN(Aid)) {
        return res.status(400).json({ error: "Auction ID ไม่ถูกต้อง" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "จำนวนเงินไม่ถูกต้อง" });
      }

      await conn.beginTransaction();

      // ✅ ดึงข้อมูลรอบมา lock (กันบิดชนกัน)
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

      // ✅ ตรวจสอบสถานะ
      if (status !== "open" || new Date(end_time) <= new Date()) {
        await conn.rollback();
        return res.status(400).json({ error: "AUCTION_CLOSED" });
      }

      // ✅ ตรวจสอบก้าวบิดขั้นต่ำ
      const requiredMin = Number(current_price) + Number(min_increment);
      if (amount < requiredMin) {
        await conn.rollback();
        return res.status(400).json({
          error: "BID_TOO_LOW",
          requiredMin,
        });
      }

      // ✅ อัปเดตราคาใหม่
      const [upd] = await conn.query<ResultSetHeader>(
        `UPDATE auctions
            SET current_price = ?
          WHERE Aid = ?`,
        [amount, Aid]
      );

      await conn.commit();
      res.json({
        ok: true,
        Aid,
        new_price: amount,
        affected: upd.affectedRows,
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
   5) ปิดประมูล
   ====================== */
router.patch(
  "/auctions/:id/close",
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { id } = req.params;
      await conn.beginTransaction();

      // ล็อกแถวก่อนปิด
      const [rows] = await conn.query<AuctionsTableRow[]>(
        `SELECT Aid FROM auctions WHERE Aid = ? FOR UPDATE`,
        [id]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบประมูล" });
      }

      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE auctions SET status = 'closed' WHERE Aid = ?`,
        [id]
      );

      await conn.commit();
      if (result.affectedRows === 0) {
        return res.status(409).json({ error: "ปิดประมูลไม่สำเร็จ" });
      }
      res.json({ message: "ปิดประมูลแล้ว" });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);


/* ===========================
   6) รายละเอียดประมูล (1 รายการ)
   =========================== */
router.get(
  "/auction/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await autoCloseExpired();

      const [rows] = await pool.query<AuctionDetailRow[]>(
        `
      SELECT a.Aid, a.start_price, a.current_price, a.end_time, a.status,
             a.min_increment,
             p.PROid, p.PROname, p.PROpicture, p.PROdetail, p.PROstatus, p.PROprice
        FROM auctions a
        JOIN auction_products p ON a.PROid = p.PROid
       WHERE a.Aid = ?
       LIMIT 1
      `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "ไม่พบรายการประมูล" });
      }
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/auction-products",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as string | undefined) ?? "all";
      const q = (req.query.q as string | undefined)?.trim();
      const available = String(req.query.available || "") === "1";

      let sql = `
        SELECT 
  p.PROid, p.PROname, p.PROpicture, p.PROprice, p.PROstatus, p.PROdetail,
  a.Aid AS active_aid, a.end_time AS active_end_time, a.current_price AS active_current_price
FROM auction_products p
LEFT JOIN auctions a ON a.PROid = p.PROid AND a.status = 'open'
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
        where.push("a.Aid IS NULL");
      }
      if (where.length) sql += ` WHERE ${where.join(" AND ")}`;

      sql += ` ORDER BY p.PROid DESC`;

      const [rows] = await pool.query<AuctionProductListRow[]>(sql, params);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

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


export default router;
