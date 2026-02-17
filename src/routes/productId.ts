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

router.put("/product/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const schema = z.object({
      Pname: z.string(),
      Pprice: z.coerce.number(),
      Pnumproduct: z.coerce.number(),
      Pdetail: z.string().optional().default(""),
      Ppicture: z.string().optional().default(""),
      Typeid: z.coerce.number(),
      Subtypeid: z.coerce.number(),
      // ไม่ต้องรับ Pstatus จาก client แล้วก็ได้
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const data = parsed.data;

    // ✅ auto status จากจำนวนคงเหลือ
    const Pstatus = data.Pnumproduct > 0 ? "In stock" : "Out of stock";

    await pool.execute(
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
      [
        data.Pname,
        data.Pprice,
        data.Pnumproduct,
        data.Pdetail,
        data.Ppicture,
        Pstatus,
        data.Typeid,
        data.Subtypeid,
        id,
      ]
    );

    res.status(200).json({ message: "อัปเดตสินค้าสำเร็จ", Pstatus });
  } catch (err) {
    next(err);
  }
});





export default router;
