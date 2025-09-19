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

    try {
        const imageUrl = `/slips/${file.filename}`;

        // 🧾 เพิ่ม Tid ลง payments
        await pool.query(
            `INSERT INTO payments (Oid, Payprice, SlipUrl, Paystatus, Tid)
       VALUES (?, ?, ?, ?, ?)`,
            [Oid, Payprice, imageUrl, 'waiting', Tid]
        );

        // 📝 อัปเดตสถานะและแนบสลิปใน orders
        await pool.query(
            `UPDATE orders SET Oslip = ?, Ostatus = 'waiting' WHERE Oid = ?`,
            [imageUrl, Oid]
        );

        res.status(201).json({ message: 'บันทึกการชำระเงินแล้ว' });
    } catch (error) {
        next(error);
    }
});



export default router;
