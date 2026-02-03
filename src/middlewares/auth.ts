import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cactus-secret-123";

export interface CustomerTokenPayload {
    role: "user";
    Cid: number;
    Cusername: string;
    Cstatus: string;
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

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
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
        (req as AuthedRequest).user = decoded;
        return next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        }
        return res.status(403).json({ message: "Token ไม่ถูกต้อง" });
    }
};
