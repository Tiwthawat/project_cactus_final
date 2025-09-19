import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { pool } from '../app';

const router = Router();

interface TokenPayload {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    iat: number;
    exp: number;
}

interface PasswordRow extends RowDataPacket {
    Cpassword: string;
}

router.patch('/change-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    let decoded: TokenPayload;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch {
        return res.status(403).json({ message: 'Invalid token' });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านให้ครบ' });
    }

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query<PasswordRow[]>(
            'SELECT Cpassword FROM customers WHERE Cid = ?',
            [decoded.Cid]
        );

        if (!rows.length || rows[0].Cpassword !== oldPassword) {
            return res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
        }

        await connection.query(
            'UPDATE customers SET Cpassword = ? WHERE Cid = ?',
            [newPassword, decoded.Cid]
        );

        return res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) {
        console.error('Change password error:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    } finally {
        connection.release();
    }
});

export default router;
