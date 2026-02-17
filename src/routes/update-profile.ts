import { Router } from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { pool } from '../app';
import { uploadProfilePicture } from '../middlewares/upload';

const router = Router();

interface TokenPayload {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    iat: number;
    exp: number;
}

router.patch('/update', uploadProfilePicture.single('profile'), async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    let decoded: TokenPayload;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch {
        return res.status(403).json({ message: 'Invalid token' });
    }

    const profileFilename = req.file?.filename ?? null;

    const {
        Cname,
        Cphone,
        Caddress,
        Csubdistrict,
        Cdistrict,
        Cprovince,
        Czipcode,
    } = req.body;

    const connection = await pool.getConnection();
    try {
        // ลบรูปเดิมเฉพาะเมื่อมีรูปใหม่
        if (profileFilename) {
            const [rows] = await connection.query<any[]>(
                `SELECT Cprofile FROM customers WHERE Cid = ?`,
                [decoded.Cid]
            );
            const oldProfile = rows[0]?.Cprofile;
            if (oldProfile) {
                const oldPath = path.join(__dirname, '../public/profiles', oldProfile);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        await connection.query(
            `
      UPDATE customers
      SET
        Cname = ?,
        Cphone = ?,
        Caddress = ?,
        Csubdistrict = ?,
        Cdistrict = ?,
        Cprovince = ?,
        Czipcode = ?,
        Cprofile = COALESCE(?, Cprofile)
      WHERE Cid = ?
      `,
            [Cname, Cphone, Caddress, Csubdistrict, Cdistrict, Cprovince, Czipcode, profileFilename, decoded.Cid]
        );

        return res.status(200).json({ message: 'อัปเดตสำเร็จ', filename: profileFilename });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    } finally {
        connection.release();
    }
});


export default router;
