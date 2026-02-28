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
        await conn.beginTransaction();

        // 1) ดึง order (lock กันส่งซ้ำ/สถานะเปลี่ยนระหว่างทาง)
        const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT Oid, Cid, Ostatus, Opayment
       FROM orders
       WHERE Oid = ?
       FOR UPDATE`,
            [Oid]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "ไม่พบออเดอร์" });
        }

        const order = rows[0];
        const status = String(order.Ostatus || '');
        const pay = String(order.Opayment || '').toLowerCase();

        // 2) กัน COD
        if (pay === 'cod' || pay === 'cash_on_delivery' || pay === 'cashondelivery') {
            await conn.rollback();
            return res.status(400).json({ message: "คำสั่งซื้อแบบ COD ไม่ต้องแนบสลิป" });
        }

        // 3) กันส่งซ้ำ/สถานะผิด
        if (status === "payment_review") {
            await conn.rollback();
            return res.status(400).json({ message: "สลิปกำลังตรวจสอบ ไม่สามารถส่งซ้ำได้" });
        }
        if (status === "paid") {
            await conn.rollback();
            return res.status(400).json({ message: "ออเดอร์นี้จ่ายเงินแล้ว ไม่สามารถส่งซ้ำได้" });
        }
        if (status !== "pending_payment") {
            await conn.rollback();
            return res.status(400).json({ message: "สถานะไม่ถูกต้อง ไม่สามารถส่งสลิปได้" });
        }

        const imageUrl = `/slips/${file.filename}`;

        // 4) บันทึก payments
        await conn.query(
            `INSERT INTO payments (Oid, Payprice, SlipUrl, Paystatus, Tid)
       VALUES (?, ?, ?, 'pending', ?)`,
            [Oid, Payprice, imageUrl, Tid]
        );

        // 5) อัปเดต order -> payment_review
        await conn.query(
            `UPDATE orders
       SET Oslip = ?, Ostatus = 'payment_review'
       WHERE Oid = ?`,
            [imageUrl, Oid]
        );

        // 6) ✅ แจ้งเตือน: payment_uploaded
        try {
            await conn.query(
                `INSERT INTO notifications (customer_id, type, title, body, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
                [
                    Number(order.Cid),
                    "payment_uploaded",
                    "แนบสลิปสำเร็จ",
                    `คำสั่งซื้อ #${Oid} ส่งสลิปแล้ว กำลังรอตรวจสอบ`,
                    `/me/orders/${Oid}`,
                ]
            );
        } catch { }

        await conn.commit();
        return res.status(201).json({ message: "ส่งสลิปสำเร็จ อยู่ระหว่างตรวจสอบ" });
    } catch (error) {
        try { await conn.rollback(); } catch { }
        next(error);
    } finally {
        conn.release();
    }
});





export default router;
