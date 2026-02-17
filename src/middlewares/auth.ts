import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../app"; // ✅ เพิ่มบรรทัดนี้ (ปรับ path ให้ตรงไฟล์จริง)

const JWT_SECRET = process.env.JWT_SECRET || "cactus-secret-123";

export interface CustomerTokenPayload {
    role: "user";
    Cid: number;
    Cusername: string;
    Cstatus?: string;
    iat?: number;
    exp?: number;
}

export interface AdminTokenPayload {
    role: "admin";
    Aid: number;
    Ausername: string;
    iat?: number;
    exp?: number;
}

export type TokenPayload = CustomerTokenPayload | AdminTokenPayload;
export type AuthedRequest = Request & { user?: TokenPayload };

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token =
        authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;

    if (!token) {
        return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ (ไม่มี token)" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

        // ✅ ถ้าเป็น user → เช็คสถานะใน DB ว่าโดนแบนไหม
        if (decoded.role === "user") {
            const [rows] = await pool.query<any[]>(
                `SELECT Cstatus FROM customers WHERE Cid = ? LIMIT 1`,
                [decoded.Cid]
            );

            if (rows.length === 0) {
                return res.status(401).json({ message: "ไม่พบผู้ใช้" });
            }

            const status = rows[0].Cstatus;

            if (status === "banned") {
                return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน (banned)" });
            }

            // ✅ อัปเดตค่า status ล่าสุดกลับเข้า req.user (กันหน้าอื่นใช้ต่อ)
            (decoded as CustomerTokenPayload).Cstatus = status;
        }

        (req as AuthedRequest).user = decoded;
        return next();

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        }
        return res.status(403).json({ message: "Token ไม่ถูกต้อง" });
    }
};
