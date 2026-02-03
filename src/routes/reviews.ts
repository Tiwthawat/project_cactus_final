import { Request, Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../app";
import { TokenPayload, verifyToken } from "../middlewares/auth";
import { uploadReviewImage } from "../middlewares/upload";

const router = Router();



interface RequestWithUser extends Request {
  user?: TokenPayload;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}


/* =====================================================
   1) รีวิวร้าน (ครั้งเดียว)
===================================================== */
router.post(
  "/reviews/store",
  verifyToken,
  uploadReviewImage.array("images", 5),
  async (req: RequestWithUser, res) => {
    try {
      const { stars, text } = req.body;
      const u = req.user;
      if (!u) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });

      if (u.role !== "user") {
        return res.status(403).json({ message: "User only" });
      }

      const Cid = u.Cid;
      const files = (req.files as Express.Multer.File[]) ?? [];

      if (!Cid) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });
      if (!stars || !text)
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

      // ✔ ตรวจว่าผู้ใช้เคยรีวิวร้านไหม (order_id IS NULL)
      const [exist] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM reviews WHERE Cid = ? AND order_id IS NULL LIMIT 1",
        [Cid]
      );

      if (exist.length > 0) {
        return res.status(400).json({ message: "คุณรีวิวร้านไปแล้ว" });
      }

      const images = files.map((f) => `/reviews/${f.filename}`);

      await pool.query(
        "INSERT INTO reviews (Cid, text, stars, order_id, images) VALUES (?, ?, ?, NULL, ?)",
        [Cid, text, Number(stars), JSON.stringify(images)]
      );

      return res.status(201).json({ message: "รีวิวร้านสำเร็จ" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
  }
);

/* =====================================================
   2) GET รีวิวร้านทั้งหมด
===================================================== */
router.get("/reviews/store", async (_req, res) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id, text, stars, images, created_at FROM reviews WHERE order_id IS NULL ORDER BY created_at DESC"
    );

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "ดึงรีวิวร้านไม่สำเร็จ" });
  }
});

/* =====================================================
   2.5) เช็กว่าผู้ใช้รีวิวร้านไปแล้วหรือยัง
===================================================== */
router.get("/reviews/store/user", verifyToken, async (req: RequestWithUser, res) => {
  try {
    const u = req.user;
    if (!u) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });

    if (u.role !== "user") {
      return res.status(403).json({ message: "User only" });
    }

    const Cid = u.Cid;

    if (!Cid) return res.json({ reviewed: false });

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM reviews WHERE Cid = ? AND order_id IS NULL LIMIT 1",
      [Cid]
    );

    return res.json({ reviewed: rows.length > 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ reviewed: false });
  }
});

/* =====================================================
   3) GET รีวิวสินค้าใน order
===================================================== */
router.get("/orders/:id/review", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT stars, text, images FROM reviews WHERE order_id = ? LIMIT 1",
      [id]
    );

    return res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "ดึงข้อมูลรีวิวล้มเหลว" });
  }
});

/* =====================================================
   4) POST รีวิวสินค้า (1 ครั้งต่อ order)
===================================================== */
router.post(
  "/orders/:id/review",
  verifyToken,
  uploadReviewImage.array("images", 5),
  async (req: RequestWithUser, res) => {
    try {
      const { id } = req.params;
      const { stars, text } = req.body;
      const u = req.user;
      if (!u) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });

      if (u.role !== "user") {
        return res.status(403).json({ message: "User only" });
      }

      const Cid = u.Cid;

      const files = (req.files as Express.Multer.File[]) ?? [];

      if (!Cid) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });
      if (!stars || !text)
        return res.status(400).json({ message: "ข้อมูลรีวิวไม่ครบ" });

      // ✔ ตรวจว่าคำสั่งซื้อนี้ถูกรีวิวแล้วหรือยัง
      const [exist] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM reviews WHERE order_id = ? LIMIT 1",
        [id]
      );

      if (exist.length > 0) {
        return res.status(400).json({ message: "คำสั่งซื้อนี้รีวิวไปแล้ว" });
      }

      const images = files.map((f) => `/reviews/${f.filename}`);

      await pool.query(
        "INSERT INTO reviews (Cid, text, stars, order_id, images) VALUES (?, ?, ?, ?, ?)",
        [Cid, text, Number(stars), Number(id), JSON.stringify(images)]
      );

      return res.status(201).json({ message: "รีวิวสินค้าสำเร็จ" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "รีวิวสินค้าไม่สำเร็จ" });
    }
  }
);

/* =====================================================
   5) DELETE รีวิวสินค้า (ลบได้เฉพาะเจ้าของ)
===================================================== */
router.delete(
  "/orders/:id/review",
  verifyToken,
  async (req: RequestWithUser, res) => {
    try {
      const { id } = req.params;
      const u = req.user;
      if (!u) return res.status(401).json({ message: "กรุณาล็อกอินก่อน" });

      if (u.role !== "user") {
        return res.status(403).json({ message: "User only" });
      }

      const Cid = u.Cid;

      if (!Cid) return res.status(401).json({ message: "ไม่ได้รับอนุญาต" });

      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM reviews WHERE order_id = ? AND Cid = ? LIMIT 1",
        [id, Cid]
      );

      if (rows.length === 0) {
        return res.status(403).json({ message: "คุณไม่มีสิทธิ์ลบรีวิวนี้" });
      }

      await pool.query("DELETE FROM reviews WHERE order_id = ?", [id]);

      return res.json({ message: "ลบรีวิวสำเร็จ" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "ลบรีวิวล้มเหลว" });
    }
  }
);

router.get("/products/:pid/reviews/summary", async (req, res) => {
  try {
    const pid = Number(req.params.pid);
    if (!pid) return res.status(400).json({ message: "pid ไม่ถูกต้อง" });

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(AVG(r.stars), 0) AS avg_stars,
        COUNT(*) AS total
      FROM reviews r
      JOIN order_items oi
        ON oi.Oid = r.order_id
       AND oi.Pid = ?
      WHERE r.order_id IS NOT NULL
      `,
      [pid]
    );

    return res.json({
      avg_stars: Number(rows?.[0]?.avg_stars ?? 0),
      total: Number(rows?.[0]?.total ?? 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "ดึงสรุปรีวิวล้มเหลว" });
  }
});

router.get("/products/:pid/reviews", async (req, res) => {
  try {
    const pid = Number(req.params.pid);
    if (!pid) return res.status(400).json({ message: "pid ไม่ถูกต้อง" });

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        r.id,
        r.text,
        r.stars,
        r.created_at,
        r.order_id,
        r.images
      FROM reviews r
      JOIN order_items oi
        ON oi.Oid = r.order_id
       AND oi.Pid = ?
      WHERE r.order_id IS NOT NULL
      ORDER BY r.created_at DESC
      `,
      [pid]
    );

    // images เป็น JSON → ส่งออกเป็น array ให้ฝั่งหน้าใช้ได้เลย
    const mapped = rows.map((r: any) => ({
      ...r,
      images:
        typeof r.images === "string"
          ? JSON.parse(r.images)
          : Array.isArray(r.images)
          ? r.images
          : [],
    }));

    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "ดึงรีวิวสินค้าล้มเหลว" });
  }
});



export default router;
