import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cactus-secret-123";

interface TokenPayload {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    iat?: number;
    exp?: number;
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    // 1) ลองอ่านจาก cookie ก่อน
    let token = req.cookies?.token as string | undefined;

    // 2) ถ้าไม่มีใน cookie → ลองอ่านจาก Authorization: Bearer xxx
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

    if (!token) {
        return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ (ไม่มี token)" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        (req as any).user = decoded;
        next();
    } catch (error) {
        console.error("JWT verify error:", error);
        return res.status(403).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
    }
};
