import { Router } from 'express';
import { pool } from '../app';

const router = Router();

interface ProductType {
    Typeid: number;
    typenproduct: string;
}

router.get('/product-types', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM product_types');
        res.status(200).json(rows as ProductType[]);
    } catch (err) {
        console.error('Error fetching product types:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ดึงประเภทย่อยตาม Typeid
router.get('/subtypes/:typeid', async (req, res) => {
    const { typeid } = req.params;

    try {
        const [rows] = await pool.query(
            'SELECT Subtypeid, subname FROM subtypes WHERE Typeid = ?',
            [typeid]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching subtypes:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/products/type/:typeid', async (req, res) => {
    const { typeid } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT p.*, t.typenproduct, s.subname
       FROM products p
       LEFT JOIN product_types t ON p.Typeid = t.Typeid
       LEFT JOIN subtypes s ON p.Subtypeid = s.Subtypeid
       WHERE p.Typeid = ?`,
            [typeid]
        );

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching products by type:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



export default router;
