import { NextFunction, Request, Response, Router } from "express";
import { RowDataPacket } from "mysql2/promise";
import { pool } from "../app";
import { verifyToken } from "../middlewares/auth";
import { requireCustomer } from "../utils/auth-guards";



const router = Router();


interface FavoriteRow extends RowDataPacket {
    product_id: number;
}

// ⭐ Toggle favorite
router.post("/", verifyToken, async (req: Request, res: Response, next: NextFunction) => {
    const u = requireCustomer(req);
    if (!u) return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });

    const customer_id = u.Cid;
    const { product_id } = req.body;

    if (!product_id) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }

    try {
        const conn = await pool.getConnection();
        try {
            const [exist] = await conn.query<FavoriteRow[]>(
                `SELECT * FROM favorites WHERE customer_id = ? AND product_id = ?`,
                [customer_id, product_id]
            );

            if (exist.length > 0) {
                await conn.execute(
                    `DELETE FROM favorites WHERE customer_id = ? AND product_id = ?`,
                    [customer_id, product_id]
                );
                return res.json({ message: "ลบรายการโปรดแล้ว", is_favorite: false });
            }

            await conn.execute(
                `INSERT INTO favorites (customer_id, product_id) VALUES (?, ?)`,
                [customer_id, product_id]
            );

            return res.json({ message: "เพิ่มรายการโปรดแล้ว", is_favorite: true });
        } finally {
            conn.release();
        }
    } catch (err) {
        next(err);
    }
});


// ⭐ ดึงรายการโปรด
router.get("/", verifyToken, async (req: Request, res: Response) => {
    const u = requireCustomer(req);
    if (!u) return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });

    const customer_id = u.Cid;


    if (!customer_id) {
        return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
    }

    try {
        const [rows] = await pool.query(
            `
    SELECT 
      p.Pid AS product_id,
      p.Pname,
      p.Pprice,
      p.Ppicture
    FROM favorites f
    JOIN products p ON f.product_id = p.Pid
    WHERE f.customer_id = ?
  `,
            [customer_id]
        );


        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "ไม่สามารถดึงรายการโปรดได้" });
    }
});

export default router;
