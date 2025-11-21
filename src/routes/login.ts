import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { FieldPacket, RowDataPacket } from 'mysql2';
import { pool } from '../app';

const router = Router();
interface CustomerPhoneRow extends RowDataPacket {
  Cid: number;
  Cusername: string;
  Cphone: string;
}

interface Customer extends RowDataPacket {
  Cid: number;
  Cusername: string;
  Cpassword: string;
  Cname: string;
  Cstatus: string;
}

// ดึง JWT_SECRET จาก .env
const JWT_SECRET = process.env.JWT_SECRET!;

router.post('/login', async (req, res, next) => {
  const { Cusername, Cpassword } = req.body;

  if (!Cusername || !Cpassword) {
    return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: [Customer[], FieldPacket[]] = await connection.query(
        'SELECT * FROM customers WHERE Cusername = ?',
        [Cusername]
      );

      if (rows.length === 0) {
        return res.status(401).json({ message: 'ไม่พบผู้ใช้งานนี้' });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(Cpassword, user.Cpassword);

      if (!isMatch) {
        return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
      }

      // ✅ Sign JWT
      const token = jwt.sign(
        {
          Cid: user.Cid,
          Cusername: user.Cusername,
          Cstatus: user.Cstatus,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // ✅ ลบ password ออกจาก response
      const { Cpassword: _pw, ...safeUser } = user;

      return res.status(200).json({
        message: 'เข้าสู่ระบบสำเร็จ',
        user: safeUser,
        token,
      });
    } catch (error) {
      next(error);
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { username, phone } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และเบอร์โทร' });
    }

    const [rows] = await pool.query<CustomerPhoneRow[]>(
      `SELECT Cid, Cusername, Cphone 
       FROM customers 
       WHERE Cusername = ? AND Cphone = ?
       LIMIT 1`,
      [username, phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งานนี้หรือเบอร์โทรไม่ถูกต้อง' });
    }

    const user = rows[0];

    // ⭐ ออก resetToken อายุ 15 นาที
    const resetToken = jwt.sign(
      {
        Cid: user.Cid,
        type: "password_reset",
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      message: "ยืนยันตัวตนสำเร็จ กรุณาตั้งรหัสผ่านใหม่",
      resetToken,
    });

  } catch (error) {
    console.error("forgot-password error:", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    let payload: any;
    try {
      payload = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'โทเคนหมดอายุหรือไม่ถูกต้อง' });
    }

    if (payload.type !== "password_reset") {
      return res.status(401).json({ message: "โทเคนประเภทไม่ถูกต้อง" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE customers SET Cpassword = ? WHERE Cid = ?`,
      [hashed, payload.Cid]
    );

    return res.json({ message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });

  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
});

export default router;
