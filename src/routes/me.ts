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

interface CustomerRow extends RowDataPacket {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    Cname: string;
    Caddress: string;
    Csubdistrict: string;
    Cdistrict: string;
    Cprovince: string;
    Czipcode: string;
    Cphone: string;
    Cdate: string;
    Cbirth: string;
    Cprofile: string;

}

router.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        let decoded: TokenPayload;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
        } catch {
            return res.status(403).json({ message: "Invalid token" });
        }

        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.query<CustomerRow[]>(`
  SELECT Cid, Cusername, Cstatus, Cname, Caddress, Csubdistrict, Cdistrict, Cprovince, Czipcode,
         Cphone, Cdate, Cbirth, Cprofile
  FROM customers WHERE Cid = ?`, [decoded.Cid]
            );



            if (rows.length === 0) {
                return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
            }

            return res.status(200).json({
                message: 'ข้อมูลผู้ใช้',
                user: rows[0],
            });
        } finally {
            connection.release();
        }
    } catch (err) {
        next(err);
    }
});



export default router;
