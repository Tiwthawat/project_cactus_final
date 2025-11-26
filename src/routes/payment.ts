import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../app';
import { uploadSlip } from '../middlewares/upload';


const router = Router();


router.get('/payment', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
      SELECT p.*, t.Tname, t.Tnum, t.Taccount, t.Tbranch, t.Tqr

      FROM payments p
      JOIN transfer t ON p.Tid = t.Tid
      ORDER BY p.Payid  DESC
    `);
        res.status(200).json(rows);
    } catch (error) {
        console.error("🔥 PAYMENT GET ERROR:", error); // 🧠 เพิ่มบรรทัดนี้
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลชำระเงิน' });
        next(error);
    }
});


router.get('/payment/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query<RowDataPacket[]>(`
  SELECT p.*, t.Tname, t.Tnum, t.Taccount, t.Tbranch, t.Tqr
  FROM payments p
  JOIN transfer t ON p.Tid = t.Tid
  WHERE p.Oid = ?
`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลการชำระเงินของคำสั่งซื้อนี้' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ' });
        next(error);
    }
});


router.post('/payment', uploadSlip.single('slip'), async (req, res, next) => {
    const { Oid, Payprice, Tid } = req.body;
    const file = req.file;

    if (!Oid || !Payprice || !file || !Tid) {
        return res.status(400).json({ message: 'ข้อมูลไม่ครบ หรือยังไม่ได้เลือกบัญชีโอน' });
    }

    const conn = await pool.getConnection();

    try {
        const [rows] = await conn.query<RowDataPacket[]>(
            "SELECT Ostatus FROM orders WHERE Oid = ?",
            [Oid]
        );

        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ message: "ไม่พบออเดอร์" });
        }

        const status = rows[0].Ostatus;

        // ⭐ กันส่งซ้ำ
        if (status === "payment_review") {
            conn.release();
            return res.status(400).json({ message: "สลิปกำลังตรวจสอบ ไม่สามารถส่งซ้ำได้" });
        }

        if (status === "paid") {
            conn.release();
            return res.status(400).json({ message: "ออเดอร์นี้จ่ายเงินแล้ว ไม่สามารถส่งซ้ำได้" });
        }

        if (status !== "pending_payment") {
            conn.release();
            return res.status(400).json({ message: "สถานะไม่ถูกต้อง ไม่สามารถส่งสลิปได้" });
        }

        const imageUrl = `/slips/${file.filename}`;

        // บันทึกลง payments
        await conn.query(
            "INSERT INTO payments (Oid, Payprice, SlipUrl, Paystatus, Tid) VALUES (?, ?, ?, ?, ?)",
            [Oid, Payprice, imageUrl, 'pending', Tid]
        );

        // update order เป็น payment_review
        await conn.query(
            "UPDATE orders SET Oslip = ?, Ostatus = 'payment_review' WHERE Oid = ?",
            [imageUrl, Oid]
        );

        conn.release();
        res.status(201).json({ message: "ส่งสลิปสำเร็จ อยู่ระหว่างตรวจสอบ" });

    } catch (error) {
        conn.release();
        next(error);
    }
});





export default router;
