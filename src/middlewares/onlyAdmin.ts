import { NextFunction, Response } from "express";
import { AuthedRequest } from "./auth";

export const onlyAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const u = req.user;

    if (!u) return res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ" });
    if (u.role !== "admin") return res.status(403).json({ message: "admin only" });

    next();
};
