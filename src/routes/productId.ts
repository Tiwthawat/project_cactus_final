import { badRequest } from "@hapi/boom";
import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../app";

const router = Router();

interface Product extends RowDataPacket {
	Pid: number;
	Pname: string;
	Pprice: number;
	Ppicture: string;

}

router.get(
	"/product/:id",
	(req, _res, next) => {
		const schema = z.object({
			id: z.coerce.number(),
		});

		const result = schema.safeParse(req.params);

		if (result.success) {
			next();
		} else {
			next(badRequest(result.error.message));
		}
	},
	async (req, res, next) => {
		try {
			const connection = await pool.getConnection();

			try {
				const [rows] = await connection.query<Product[]>(
					"SELECT * FROM products WHERE Pid = ?",
					[req.params.id]
				);

				if (rows.length === 0) {
					return res.status(404).json({ message: "ไม่พบสินค้า" });
				}

				res.status(200).json(rows[0]);
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

router.put('/product/:id', async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			Pname,
			Pprice,
			Pnumproduct,
			Pdetail,
			Ppicture,
			Pstatus,
			Typeid,
			Subtypeid
		} = req.body;

		const [result] = await pool.execute(

			`UPDATE products SET 
    Pname = ?, 
    Pprice = ?, 
    Pnumproduct = ?, 
    Pdetail = ?, 
    Ppicture = ?, 
    Pstatus = ?,
    Typeid = ?, 
    Subtypeid = ?
  WHERE Pid = ?`,
			[Pname, Pprice, Pnumproduct, Pdetail, Ppicture, Pstatus, Typeid, Subtypeid, id]
		);


		const schema = z.object({
			Pname: z.string(),
			Pprice: z.number(),
			Pnumproduct: z.number(),
			Pdetail: z.string(),
			Ppicture: z.string(),
			Pstatus: z.string(),
			Typeid: z.number(),
			Subtypeid: z.number(),
		});

		const parsed = schema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });
		}

		res.status(200).json({ message: 'อัปเดตสินค้าสำเร็จ' });
	} catch (err) {
		res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสินค้า' });
		next(err);
	}
});




export default router;
