import { Router } from "express";
import { pool } from "../app";

const router = Router();

// GET รีวิวทั้งหมด
router.get("/reviews", async (_req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query("SELECT id, text, stars FROM reviews ORDER BY created_at DESC");
      res.status(200).json(result);
    } catch (error) {
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

// POST เพิ่มรีวิวใหม่
router.post("/reviews", async (req, res, next) => {
  const { text, stars } = req.body;

  if (!text || typeof stars !== "number" || stars < 1 || stars > 5) {
    return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
  }

  try {
    const connection = await pool.getConnection();
    try {
      await connection.execute("INSERT INTO reviews (text, stars) VALUES (?, ?)", [text, stars]);
      res.status(201).json({ message: "เพิ่มรีวิวสำเร็จ" });
    } catch (error) {
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

router.delete("/review/:id", async (req, res) => {
  const orderId = Number(req.params.id);

  try {
    const connection = await pool.getConnection();
    try {
      await connection.execute("DELETE FROM reviews WHERE order_id = ?", [orderId]);
      res.status(200).json({ message: "ลบรีวิวสำเร็จ" });
    } catch (err) {
      console.error("ลบรีวิวล้มเหลว:", err);
      res.status(500).json({ error: "ไม่สามารถลบรีวิวได้" });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });
  }
});


export default router;
