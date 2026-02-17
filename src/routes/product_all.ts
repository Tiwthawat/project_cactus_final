import { NextFunction, Request, Response, Router } from "express";
import { pool } from "../app";

const router = Router();

export interface Product {
	Pid: number;           // รหัสสินค้า (Primary Key)
	Pname: string;         // ชื่อสินค้า
	Pprice: number;        // ราคาสินค้า
	Pnumproduct: number;   // จำนวนคงเหลือ
	Ppicture: string;      // URL ของรูปภาพ
	Pdetail: string;       // รายละเอียดสินค้า
	Pstatus: string;       // สถานะสินค้า เช่น "In stock", "Out of stock"
	Prenume: number;       // จำนวนที่ขายไปแล้ว
	Subtypeid: number;
}

// ✅ GET /product (รองรับ filter typeid, subtypeid)
router.get(
	"/product",
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const connection = await pool.getConnection();

			const typeidParam = req.query.typeid as string | undefined;
			const subtypeidParam = req.query.subtypeid as string | undefined;
			const searchParam = req.query.search as string | undefined;

			const typeid = typeidParam ? parseInt(typeidParam, 10) : undefined;
			const subtypeid = subtypeidParam ? parseInt(subtypeidParam, 10) : undefined;

			try {
				let sql = `
          SELECT p.*, t.typenproduct, s.subname
          FROM products p
          LEFT JOIN product_types t ON p.Typeid = t.Typeid
          LEFT JOIN subtypes s ON p.Subtypeid = s.Subtypeid
        `;

				const params: any[] = [];
				const conditions: string[] = [];

				// ตามหมวดหมู่ใหญ่
				if (typeid !== undefined && !isNaN(typeid)) {
					conditions.push("p.Typeid = ?");
					params.push(typeid);
				}

				// ตามหมวดย่อย
				if (subtypeid !== undefined && !isNaN(subtypeid)) {
					conditions.push("p.Subtypeid = ?");
					params.push(subtypeid);
				}

				if (searchParam && searchParam.trim()) {
					conditions.push("p.Pname LIKE ?");
					params.push(`%${searchParam}%`);
				}


				if (conditions.length > 0) {
					sql += " WHERE " + conditions.join(" AND ");
				}

				sql += " ORDER BY p.Pid DESC";

				const [rows] = await connection.query(sql, params);
				res.status(200).json(rows);
			} catch (error) {
				next(error);
			} finally {
				connection.release();
			}
		} catch (error) {
			next(error);
		}
	}
);


// ✅ DELETE /product/:id
router.delete("/product/:id", async (req: Request, res: Response, next: NextFunction) => {
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

// ✅ POST /product
router.post("/product", async (req: Request, res: Response, next: NextFunction) => {
	const {
		Pname,
		Pprice,
		Pnumproduct,
		Ppicture,
		Pdetail,
		Pstatus,
		Prenume = 0,
		Typeid,
		Subtypeid,
	} = req.body;
	const PstatusAuto = Number(Pnumproduct) > 0 ? "In stock" : "Out of stock";

	try {
		await pool.query(
  `INSERT INTO products 
   (Pname, Pprice, Pnumproduct, Ppicture, Pdetail, Pstatus, Prenume, Typeid, Subtypeid)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [Pname, Pprice, Pnumproduct, Ppicture, Pdetail, PstatusAuto, Prenume, Typeid, Subtypeid]
);
		res.status(201).json({ message: "เพิ่มสินค้าสำเร็จ" });
	} catch (err) {
		next(err);
	}
});

// ✅ GET /product/latest
router.get("/product/latest", async (_req: Request, res: Response, next: NextFunction) => {
	const connection = await pool.getConnection();
	try {
		const [rows] = await connection.query(
			`
      SELECT p.*, t.typenproduct, s.subname
      FROM products p
      LEFT JOIN product_types t ON p.Typeid = t.Typeid
      LEFT JOIN subtypes s ON p.Subtypeid = s.Subtypeid
      ORDER BY p.Pid DESC
      LIMIT 10
      `
		);
		res.status(200).json(rows);
	} catch (err) {
		next(err);
	} finally {
		connection.release();
	}
});


export default router;
