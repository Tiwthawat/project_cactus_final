import { Router } from "express";
import { pool } from "../app";

const router = Router();

export interface Product {
	Pid: number;           // รหัสสินค้า (Primary Key)
	Pname: string;         // ชื่อสินค้า
	Pprice: number;        // ราคาสินค้า
	Pnumproduct: number;   // จำนวนคงเหลือ
	Ppicture: string;      // URL ของรูปภาพ (คั่นด้วย comma ถ้ามีหลายรูป)
	Pdetail: string;       // รายละเอียดสินค้า
	Pstatus: string;       // สถานะสินค้า เช่น "In stock", "Out of stock"
	Prenume: number;
	Subtypeid: number;     // จำนวนที่ขายไปแล้ว
}



router.get("/product", async (_req, res, next) => {
	try {
		const connection = await pool.getConnection();

		try {
			const result = await connection.query(`
  SELECT p.*, t.typenproduct, s.subname
  FROM products p
  LEFT JOIN product_types t ON p.Typeid = t.Typeid
  LEFT JOIN subtypes s ON p.Subtypeid = s.Subtypeid
`);

			res.status(200).json(result[0]);



		} catch (error) {
			next(error);
		} finally {
			connection.release();
		}
	} catch (error) {
		next(error);
	}
});

router.delete("/product/:id", async (req, res, next) => {
	const { id } = req.params;
	const connection = await pool.getConnection();

	try {
		await connection.query("DELETE FROM products WHERE Pid = ?", [id]);
		res.status(200).json({ message: "ลบสินค้าสำเร็จ" });
	} catch (error) {
		next(error);
	} finally {
		connection.release();
	}
});

router.post('/product', async (req, res, next) => {
	const { Pname, Pprice, Pnumproduct, Ppicture, Pdetail, Pstatus, Prenume = 0, Typeid, Subtypeid } = req.body;
	try {
		await pool.query(
			`INSERT INTO products 
        (Pname, Pprice, Pnumproduct, Ppicture, Pdetail, Pstatus, Prenume, Typeid, Subtypeid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[Pname, Pprice, Pnumproduct, Ppicture, Pdetail, Pstatus, Prenume, Typeid, Subtypeid]
		);
		res.status(201).json({ message: 'เพิ่มสินค้าสำเร็จ' });
	} catch (err) {
		next(err);
	}
});

router.get('/product/latest', async (req, res) => {
	try {
		const [rows] = await pool.query(
			'SELECT * FROM products ORDER BY Pid DESC LIMIT 10'
		);
		res.json(rows);
	} catch (err) {
		console.error('Error fetching latest products:', err);
		res.status(500).json({ error: 'Internal Server Error' });
	}
});






export default router;
