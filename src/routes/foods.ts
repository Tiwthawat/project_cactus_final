import { Router } from "express";
import { pool } from "../app";

const router = Router();

router.get("/foods", async (_req, res, next) => {
	try {
		const connection = await pool.getConnection();

		try {
			const result = await connection.query("SELECT * FROM food_items;");
			res.json({ result });
		} catch (error) {
			next(error);
		} finally {
			connection.release();
		}
	} catch (error) {
		next(error);
	}
});

export default router;
