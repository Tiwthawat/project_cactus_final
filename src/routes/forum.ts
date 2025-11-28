import { Request, Response, Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";
import { TokenPayload, verifyToken } from "../middlewares/auth";

// ขยาย req.user
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

const router = Router();

/* ==================================
   Interface
================================== */
export interface ForumQuestion extends RowDataPacket {
    Askid: number;
    Cid: number;
    Asktopic: string;
    Askdetails: string;
    Askdate: string;
    Askvisits: number;
    Cname: string;
    Cprofile: string | null;
    ReplyCount: number;
}

export interface ForumReply extends RowDataPacket {
    Replyid: number;
    Askid: number;
    Cid: number;
    Replydetails: string;
    Replydate: string;
    Cname: string;
    Cprofile: string | null;
}

/* ==================================
   ⭐ 1) แก้ไขคอมเมนต์ ต้องมาก่อน /:Askid
================================== */
router.put("/reply/:Replyid", verifyToken, async (req: Request, res: Response) => {
    const Replyid = Number(req.params.Replyid);
    const { Replydetails } = req.body;

    const [reply] = await pool.query<RowDataPacket[]>(
        "SELECT Cid FROM replies WHERE Replyid = ?",
        [Replyid]
    );

    if (reply.length === 0) return res.status(404).json({ error: "Reply not found" });
    if (reply[0].Cid !== req.user!.Cid) return res.status(403).json({ error: "Forbidden" });

    await pool.query(
        "UPDATE replies SET Replydetails = ? WHERE Replyid = ?",
        [Replydetails, Replyid]
    );

    res.json({ success: true });
});

/* ==================================
   ⭐ 2) ลบคอมเมนต์ ต้องมาก่อน /:Askid
================================== */
router.delete("/reply/:Replyid", verifyToken, async (req: Request, res: Response) => {
    const Replyid = Number(req.params.Replyid);

    const [reply] = await pool.query<RowDataPacket[]>(
        "SELECT Cid FROM replies WHERE Replyid = ?",
        [Replyid]
    );

    if (reply.length === 0) return res.status(404).json({ error: "Reply not found" });

    const isOwner = reply[0].Cid === req.user!.Cid;
    const isAdmin = req.user!.Cstatus === "admin";

    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    await pool.query("DELETE FROM replies WHERE Replyid = ?", [Replyid]);

    res.json({ success: true });
});

/* ==================================
   3) GET /forum/list (pagination + search + sort)
================================== */
router.get("/list", async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "");
    const sort = String(req.query.sort || "latest");

    let order = "q.Askid DESC";
    if (sort === "popular") order = "q.Askvisits DESC";
    if (sort === "active") order = "ReplyCount DESC";

    try {
        const [rows] = await pool.query<ForumQuestion[]>(
            `
            SELECT 
                q.*, c.Cname, c.Cprofile,
                (SELECT COUNT(*) FROM replies WHERE Askid = q.Askid) AS ReplyCount
            FROM questions q
            JOIN customers c ON q.Cid = c.Cid
            WHERE q.Asktopic LIKE ?
            ORDER BY ${order}
            LIMIT ? OFFSET ?
            `,
            [`%${search}%`, limit, offset]
        );

        res.json(rows);
    } catch (err) {
        console.error("[GET /forum/list] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   4) GET /forum/:Askid (เพิ่มยอดวิว + โหลดโพสต์ + คอมเมนต์)
================================== */
router.get("/:Askid", async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    if (isNaN(Askid)) return res.status(400).json({ error: "Invalid Askid" });

    try {
        await pool.query("UPDATE questions SET Askvisits = Askvisits + 1 WHERE Askid = ?", [Askid]);

        const [topic] = await pool.query<ForumQuestion[]>(
            `
            SELECT 
                q.*, c.Cname, c.Cprofile,
                (SELECT COUNT(*) FROM replies WHERE Askid = q.Askid) AS ReplyCount
            FROM questions q
            JOIN customers c ON q.Cid = c.Cid
            WHERE q.Askid = ?
            `,
            [Askid]
        );

        if (topic.length === 0) return res.status(404).json({ error: "Topic not found" });

        const [comments] = await pool.query<ForumReply[]>(
            `
            SELECT r.*, c.Cname, c.Cprofile
            FROM replies r
            JOIN customers c ON r.Cid = c.Cid
            WHERE r.Askid = ?
            ORDER BY r.Replyid ASC
            `,
            [Askid]
        );

        res.json({
            topic: topic[0],
            comments,
        });
    } catch (err) {
        console.error("[GET /forum/:Askid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   5) POST /forum (ตั้งกระทู้ใหม่)
================================== */
router.post("/", verifyToken, async (req: Request, res: Response) => {
    const { Asktopic, Askdetails } = req.body;

    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!Asktopic || !Askdetails) return res.status(400).json({ error: "Missing fields" });

    try {
        const [result] = await pool.query<ResultSetHeader>(
            `
            INSERT INTO questions (Cid, Asktopic, Askdetails)
            VALUES (?, ?, ?)
            `,
            [req.user.Cid, Asktopic, Askdetails]
        );

        res.json({ success: true, Askid: result.insertId });
    } catch (err) {
        console.error("[POST /forum] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   6) POST /forum/:Askid/reply (ตอบกระทู้)
================================== */
router.post("/:Askid/reply", verifyToken, async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    const { Replydetails } = req.body;

    if (isNaN(Askid)) return res.status(400).json({ error: "Invalid Askid" });
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!Replydetails) return res.status(400).json({ error: "Missing reply" });

    try {
        const [result] = await pool.query<ResultSetHeader>(
            `
            INSERT INTO replies (Askid, Cid, Replydetails)
            VALUES (?, ?, ?)
            `,
            [Askid, req.user.Cid, Replydetails]
        );

        res.json({ success: true, Replyid: result.insertId });
    } catch (err) {
        console.error("[POST /forum/:Askid/reply] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   7) PUT /forum/:Askid (แก้ไขกระทู้)
================================== */
router.put("/:Askid", verifyToken, async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    const { Asktopic, Askdetails } = req.body;

    const [owner] = await pool.query<RowDataPacket[]>(
        "SELECT Cid FROM questions WHERE Askid = ?",
        [Askid]
    );

    if (owner.length === 0) return res.status(404).json({ error: "Topic not found" });
    if (owner[0].Cid !== req.user!.Cid) return res.status(403).json({ error: "Forbidden" });

    await pool.query(
        "UPDATE questions SET Asktopic = ?, Askdetails = ? WHERE Askid = ?",
        [Asktopic, Askdetails, Askid]
    );

    res.json({ success: true });
});

/* ==================================
   8) DELETE /forum/:Askid (ลบกระทู้)
================================== */
router.delete("/:Askid", verifyToken, async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT Cid FROM questions WHERE Askid = ?",
        [Askid]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Topic not found" });
    if (rows[0].Cid !== req.user!.Cid) return res.status(403).json({ error: "Forbidden" });

    await pool.query("DELETE FROM replies WHERE Askid = ?", [Askid]);
    await pool.query("DELETE FROM questions WHERE Askid = ?", [Askid]);

    res.json({ success: true });
});

export default router;
