import { Router } from 'express';
import { RowDataPacket } from 'mysql2';
import { pool } from '../app';
import { verifyToken } from '../middlewares/auth';
import { onlyAdmin } from '../middlewares/onlyAdmin';

const router = Router();

router.use(verifyToken, onlyAdmin);

function parseImages(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string');
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
        } catch {
            return raw.startsWith('/') ? [raw] : [];
        }
    }
    return [];
}

/**
 * GET /admin/reviews
 * ดึงรีวิวทั้งหมด (รีวิวร้าน + รีวิวจากออเดอร์)
 */
router.get('/', async (_req, res) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `
      SELECT
        r.id,
        r.text,
        r.stars,
        r.created_at,
        r.order_id,
        r.images,
        r.admin_reply,
        r.replied_at,
        c.Cname
      FROM reviews r
      LEFT JOIN customers c ON c.Cid = r.Cid
      LEFT JOIN orders o ON o.Oid = r.order_id
      ORDER BY r.created_at DESC
      `
        );

        const mapped = rows.map((r: any) => ({
            ...r,
            images: parseImages(r.images),
        }));

        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'ไม่สามารถโหลดรีวิวทั้งหมดได้' });
    }
});

/**
 * PATCH /admin/reviews/:id/reply
 * ตอบกลับหรือแก้คำตอบ (ส่ง reply เป็น "" เพื่อเคลียร์คำตอบ)
 */
router.patch('/:id/reply', async (req, res) => {
    const id = Number(req.params.id);
    const { reply } = req.body ?? {};

    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });
    if (typeof reply !== 'string') return res.status(400).json({ message: 'reply ไม่ถูกต้อง' });

    const clean = reply.trim();

    try {
        if (clean.length === 0) {
            await pool.query(
                'UPDATE reviews SET admin_reply = NULL, replied_at = NULL WHERE id = ?',
                [id]
            );
            return res.json({ message: 'ลบคำตอบแล้ว' });
        }

        await pool.query(
            'UPDATE reviews SET admin_reply = ?, replied_at = NOW() WHERE id = ?',
            [clean, id]
        );

        return res.json({ message: 'ตอบกลับสำเร็จ' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'ตอบกลับไม่สำเร็จ' });
    }
});

/**
 * DELETE /admin/reviews/:id
 */
router.delete('/:id', async (req, res) => {
    const reviewId = Number(req.params.id);
    if (!reviewId) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    try {
        await pool.query('DELETE FROM reviews WHERE id = ?', [reviewId]);
        res.json({ message: 'ลบรีวิวแล้ว' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'ลบไม่สำเร็จ' });
    }
});

/**
 * GET /admin/reviews/order/:id
 * ดึงรีวิวของออเดอร์เฉพาะตัว (ถ้าจะใช้)
 */
router.get('/order/:id', async (req, res) => {
    const orderId = Number(req.params.id);
    if (!orderId) return res.status(400).json({ message: 'order id ไม่ถูกต้อง' });

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, text, stars, images, created_at, admin_reply, replied_at FROM reviews WHERE order_id = ? LIMIT 1',
            [orderId]
        );

        if (rows.length === 0) return res.json(null);

        const r: any = rows[0];
        res.json({
            ...r,
            images: parseImages(r.images),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'ไม่สามารถโหลดรีวิวได้' });
    }
});

export default router;
