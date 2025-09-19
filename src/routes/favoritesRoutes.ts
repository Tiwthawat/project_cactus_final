import { NextFunction, Request, Response, Router } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { pool } from '../app';

interface Favorite extends RowDataPacket {
    id: number;
    product_id: number;
    Pname: string;
    Ppicture: string;
    Pprice: number;
}


const router = Router();

// ✅ เพิ่มสินค้าเข้ารายการโปรด
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const { customer_id, product_id } = req.body;

    if (!customer_id || !product_id) {
        return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    }

    try {
        const connection = await pool.getConnection();
        try {
            const [exist] = await connection.query<Favorite[]>(
                'SELECT * FROM favorites WHERE customer_id = ? AND product_id = ?',
                [customer_id, product_id]
            );

            if (exist.length > 0) {
                // ลบรายการโปรดถ้ามีอยู่แล้ว
                await connection.execute(
                    'DELETE FROM favorites WHERE customer_id = ? AND product_id = ?',
                    [customer_id, product_id]
                );
                return res.status(200).json({ message: 'ลบรายการโปรดแล้ว' });
            }

            // ถ้ายังไม่มี → เพิ่มเข้า
            await connection.execute(
                'INSERT INTO favorites (customer_id, product_id) VALUES (?, ?)',
                [customer_id, product_id]
            );
            res.status(201).json({ message: 'เพิ่มรายการโปรดแล้ว' });
        } finally {
            connection.release();
        }
    } catch (err) {
        next(err);
    }
});


// ตัวอย่าง favoritesRoutes.ts
router.get('/:customer_id', async (req, res) => {
    const { customer_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT p.Pid, p.Pname, p.Pprice, p.Ppicture
   FROM favorites f
   JOIN products p ON f.product_id = p.Pid
   WHERE f.customer_id = ?`,
            [customer_id]
        );


        res.json(rows); // คืนข้อมูลรายการโปรด
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'ไม่สามารถดึงรายการโปรดได้' });
    }
});






export default router;
