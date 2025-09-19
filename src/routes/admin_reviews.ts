import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../app'; // ใช้ path นี้เพราะอยู่ในระดับเดียวกับ app.ts

const router = Router();

// ดึงรีวิวทั้งหมด
router.get('/', async (_req, res) => {
    try {
        const [rows] = await pool.query(`
      SELECT r.id, r.text, r.stars, r.created_at, o.Oid AS order_id
      FROM reviews r
      JOIN orders o ON r.order_id = o.Oid
      ORDER BY r.created_at DESC
    `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'ไม่สามารถโหลดรีวิวทั้งหมดได้' });
    }
});

// ลบรีวิว
router.delete('/:id', async (req, res) => {
    const reviewId = req.params.id;
    try {
        await pool.query('DELETE FROM reviews WHERE id = ?', [reviewId]);
        res.json({ message: 'ลบรีวิวแล้ว' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'ลบไม่สำเร็จ' });
    }
});

// GET /admin/orders/:id/review
router.get('/admin/orders/:id/review', async (req, res) => {
    const orderId = req.params.id;
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM reviews WHERE order_id = ?',
            [orderId]
        );
        if (rows.length === 0) return res.json(null);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'ไม่สามารถโหลดรีวิวได้' });
    }
});


export default router;
