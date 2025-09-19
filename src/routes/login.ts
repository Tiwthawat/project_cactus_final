import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { FieldPacket, RowDataPacket } from 'mysql2';
import { pool } from '../app';

const router = Router();

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

export default router;
