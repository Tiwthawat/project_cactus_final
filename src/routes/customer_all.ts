//customers_all.ts
import { Router } from "express";
import { pool } from "../app";

const router = Router();

router.get("/customers", async (_req, res, next) => {
  try {
    const connection = await pool.getConnection();

    try {
      const result = await connection.query(
        `SELECT 
          c.*, 
          COUNT(o.Oid) AS orderCount 
         FROM customers c
         LEFT JOIN orders o ON c.Cid = o.Cid
         WHERE c.Cstatus != 'deleted'
         GROUP BY c.Cid`
      );
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


// PUT /customers/:id/status
router.put('/customers/:id/status', async (req, res, next) => {
  const { id } = req.params;
  const { Cstatus } = req.body;

  try {
    await pool.query('UPDATE customers SET Cstatus = ? WHERE Cid = ?', [Cstatus, id]);
    res.status(200).json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (error) {
    next(error);
  }
});

router.put("/customers/delete/:id", async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE customers SET Cstatus = 'deleted' WHERE Cid = ?",
        [req.params.id]
      );
      res.status(200).json({ message: "ลบผู้ใช้แล้วแบบ soft delete" });
    } catch (err) {
      next(err);
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
});

// customers_all.ts หรือไฟล์ใหม่
router.get("/customers/:id/orders", async (req, res, next) => {
  const { id } = req.params;
  try {
    const connection = await pool.getConnection();

    try {
      const result = await connection.query(
        `SELECT 
          o.Oid, o.Odate, o.Ostatus, o.Ototal, 
          GROUP_CONCAT(p.Pname SEPARATOR ', ') AS products
        FROM orders o
        JOIN order_items oi ON o.Oid = oi.Oid
        JOIN products p ON oi.Pid = p.Pid
        WHERE o.Cid = ?
        GROUP BY o.Oid
        ORDER BY o.Odate DESC`,
        [id]
      );
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





export default router;
// router.post("/login", async (req, res) => {
// 	const { username, password } = req.body;
  
// 	const [rows] = await pool.query<customers[]>(
// 	  "SELECT * FROM customers WHERE Cusername = ? AND Cpassword = ?",
// 	  [username, password]
// 	);
  
// 	if (rows.length === 0) {
// 	  return res.status(401).json({ message: "เข้าสู่ระบบไม่สำเร็จ" });
// 	}
  
// 	res.json({ message: "เข้าสู่ระบบสำเร็จ", user: rows[0] });
//   });




