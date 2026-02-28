// devbc-express-ts/src/routes/notifications.ts

import { Request, Response, Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../app";
import { AuthedRequest, CustomerTokenPayload, verifyToken } from "../middlewares/auth";


interface UnreadCountRow extends RowDataPacket {
    total: number;
}

export interface NotificationListItem extends RowDataPacket {
    Nid: number;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    is_read: 0 | 1;
    created_at: string;
}

type ListResponse = { items: NotificationListItem[] };
type UnreadCountResponse = { unread: number };

function clampInt(
    n: unknown,
    min: number,
    max: number,
    fallback: number
): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    const xi = Math.floor(x);
    return Math.max(min, Math.min(max, xi));
}

function getCustomer(req: Request): CustomerTokenPayload | null {
    const user = (req as AuthedRequest).user;
    if (!user) return null;
    if (user.role !== "user") return null;
    return user as CustomerTokenPayload;
}

const router = Router();



router.get("/unread-count", verifyToken, async (req: Request, res: Response) => {
    const customer = getCustomer(req);
    if (!customer) return res.status(403).json({ message: "สำหรับผู้ใช้เท่านั้น" });

    const [rows] = await pool.query<UnreadCountRow[]>(
        `SELECT COUNT(*) AS total
     FROM notifications
     WHERE customer_id = ? AND is_read = 0`,
        [customer.Cid]
    );

    const unread = Number(rows?.[0]?.total ?? 0);
    const payload: UnreadCountResponse = { unread };
    return res.json(payload);
});

router.get("/", verifyToken, async (req: Request, res: Response) => {
    const customer = getCustomer(req);
    if (!customer) return res.status(403).json({ message: "สำหรับผู้ใช้เท่านั้น" });

    const limit = clampInt(req.query.limit, 1, 50, 20);
    const onlyUnread = String(req.query.onlyUnread ?? "") === "1";

    const [rows] = await pool.query<NotificationListItem[]>(
        `SELECT Nid, type, title, body, link, is_read, created_at
     FROM notifications
     WHERE customer_id = ?
       AND (${onlyUnread ? "is_read = 0" : "1=1"})
     ORDER BY Nid DESC
     LIMIT ?`,
        [customer.Cid, limit]
    );

    const payload: ListResponse = { items: rows };
    return res.json(payload);
});

router.patch("/:id/read", verifyToken, async (req: Request, res: Response) => {
    const customer = getCustomer(req);
    if (!customer) return res.status(403).json({ message: "สำหรับผู้ใช้เท่านั้น" });

    const nid = Number(req.params.id);
    if (!Number.isFinite(nid) || nid <= 0) {
        return res.status(400).json({ message: "notification id ไม่ถูกต้อง" });
    }

    await pool.query(
        `UPDATE notifications
     SET is_read = 1, read_at = NOW()
     WHERE Nid = ? AND customer_id = ?`,
        [nid, customer.Cid]
    );

    return res.json({ ok: true });
});

router.patch("/read-all", verifyToken, async (req: Request, res: Response) => {
    const customer = getCustomer(req);
    if (!customer) return res.status(403).json({ message: "สำหรับผู้ใช้เท่านั้น" });

    await pool.query(
        `UPDATE notifications
     SET is_read = 1, read_at = NOW()
     WHERE customer_id = ? AND is_read = 0`,
        [customer.Cid]
    );

    return res.json({ ok: true });
});

export default router;