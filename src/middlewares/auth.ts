import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "cactus-secret-123";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token; // <-- ✅ อ่านจาก cookie

    if (!token) {
        return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ (ไม่มี token)" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
    }
};
