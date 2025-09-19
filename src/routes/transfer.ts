import { Router } from 'express';
import { pool } from '../app';
import { uploadQr } from '../middlewares/upload'; // 👈 เพิ่มตรงนี้

const router = Router();

router.get('/transfer', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM transfer');
    res.status(200).json(rows);
});

router.post('/transfer', uploadQr.single('qrcode'), async (req, res) => {
    const { Tname, Tnum, Taccount, Tbranch } = req.body;
    const file = req.file;

    if (!Tname || !Tnum || !Taccount || !file) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบและอัปโหลด QR code' });
    }

    const Tqr = `/qrs/${file.filename}`;
    await pool.query(
        'INSERT INTO transfer (Tname, Tnum, Taccount, Tbranch, Tqr) VALUES (?, ?, ?, ?, ?)',
        [Tname, Tnum, Taccount, Tbranch, Tqr]
    );

    res.status(201).json({ message: 'เพิ่มช่องทางโอนเงินเรียบร้อยแล้ว' });
});

export default router;
