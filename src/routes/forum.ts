import { Request, Response, Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";
import { verifyToken } from "../middlewares/auth";
import { uploadForumImage } from "../middlewares/upload";

const router = Router();

/* ==================================
   Auth types (แก้ TS 2367 ตรงนี้)
================================== */
type UserToken = { role: "user"; Cid: number };
type AdminToken = { role: "admin"; Aid: number };
type AuthedToken = UserToken | AdminToken;

function getAuth(req: Request): AuthedToken | null {
    const u = (req.user as any) ?? null;
    if (!u || typeof u !== "object") return null;

    if (u.role === "user" && typeof u.Cid === "number") return u as UserToken;
    if (u.role === "admin" && typeof u.Aid === "number") return u as AdminToken;

    return null;
}

function isUserToken(u: AuthedToken): u is UserToken {
    return u.role === "user";
}

function isAdminToken(u: AuthedToken): u is AdminToken {
    return u.role === "admin";
}

/* ==================================
   Interfaces (response rows)
================================== */
export interface ForumQuestion extends RowDataPacket {
    Askid: number;
    Cid: number;
    Asktopic: string;
    Askdetails: string;
    Askimages: any;
    Askdate: string;
    Askvisits: number;

    Cname: string;
    Cprofile: string | null;

    ReplyCount: number;
}

export interface ForumReply extends RowDataPacket {
    Replyid: number;
    Askid: number;

    Cid: number | null;
    Adminid: number | null;
    Replyrole: "user" | "admin";

    Replydetails: string;
    Replyimages: any;
    Replydate: string;

    Cname: string;
    Cprofile: string | null;
}

/* ==================================
   GET /forum/list
================================== */
router.get("/list", async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "latest");

    let order = "q.Askid DESC";
    if (sort === "popular") order = "q.Askvisits DESC";
    if (sort === "active") order = "ReplyCount DESC";

    try {
        const like = `%${search}%`;

        const [rows] = await pool.query<ForumQuestion[]>(
            `
      SELECT 
        q.Askid, q.Cid, q.Asktopic, q.Askdetails, q.Askimages, q.Askdate, q.Askvisits,
        c.Cname, c.Cprofile,
        (SELECT COUNT(*) FROM replies WHERE Askid = q.Askid) AS ReplyCount
      FROM questions q
      JOIN customers c ON q.Cid = c.Cid
      WHERE (? = '' OR (q.Asktopic LIKE ? OR q.Askdetails LIKE ?))
      ORDER BY ${order}
      LIMIT ? OFFSET ?
      `,
            [search, like, like, limit, offset]
        );

        res.json(rows);
    } catch (err) {
        console.error("[GET /forum/list] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   PUT /forum/reply/:Replyid
================================== */
router.put("/reply/:Replyid", verifyToken, async (req: Request, res: Response) => {
    const Replyid = Number(req.params.Replyid);
    const Replydetails = String(req.body?.Replydetails ?? "").trim();

    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if (!Replydetails) return res.status(400).json({ error: "Missing Replydetails" });

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT Cid, Adminid, Replyrole FROM replies WHERE Replyid = ?",
            [Replyid]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Reply not found" });

        const r = rows[0] as any;

        const owner =
            (r.Replyrole === "user" && isUserToken(u) && r.Cid === u.Cid) ||
            (r.Replyrole === "admin" && isAdminToken(u) && r.Adminid === u.Aid);

        if (!owner) return res.status(403).json({ error: "Forbidden" });

        await pool.query("UPDATE replies SET Replydetails = ? WHERE Replyid = ?", [Replydetails, Replyid]);
        res.json({ success: true });
    } catch (err) {
        console.error("[PUT /forum/reply/:Replyid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   DELETE /forum/reply/:Replyid
   - owner ลบได้
   - admin ลบได้ทุก reply
================================== */
router.delete("/reply/:Replyid", verifyToken, async (req: Request, res: Response) => {
    const Replyid = Number(req.params.Replyid);

    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT Cid, Adminid, Replyrole FROM replies WHERE Replyid = ?",
            [Replyid]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Reply not found" });

        const r = rows[0] as any;

        const owner =
            (r.Replyrole === "user" && isUserToken(u) && r.Cid === u.Cid) ||
            (r.Replyrole === "admin" && isAdminToken(u) && r.Adminid === u.Aid);

        const admin = isAdminToken(u);

        if (!owner && !admin) return res.status(403).json({ error: "Forbidden" });

        await pool.query("DELETE FROM replies WHERE Replyid = ?", [Replyid]);
        res.json({ success: true });
    } catch (err) {
        console.error("[DELETE /forum/reply/:Replyid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   GET /forum/:Askid
   - count=0 ไม่เพิ่มวิว
================================== */
router.get("/:Askid", async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    if (isNaN(Askid)) return res.status(400).json({ error: "Invalid Askid" });

    const count = String(req.query.count ?? "1") !== "0";

    try {
        if (count) {
            await pool.query("UPDATE questions SET Askvisits = Askvisits + 1 WHERE Askid = ?", [Askid]);
        }

        const [topic] = await pool.query<ForumQuestion[]>(
            `
      SELECT 
        q.Askid, q.Cid, q.Asktopic, q.Askdetails, q.Askimages, q.Askdate, q.Askvisits,
        c.Cname, c.Cprofile,
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
      SELECT 
        r.Replyid, r.Askid, r.Cid, r.Adminid, r.Replyrole,
        r.Replydetails, r.Replyimages, r.Replydate,
        CASE WHEN r.Replyrole='admin' THEN a.Aname ELSE cu.Cname END AS Cname,
        CASE WHEN r.Replyrole='admin' THEN NULL ELSE cu.Cprofile END AS Cprofile
      FROM replies r
      LEFT JOIN customers cu ON r.Cid = cu.Cid
      LEFT JOIN admin a ON r.Adminid = a.Aid
      WHERE r.Askid = ?
      ORDER BY r.Replyid ASC
      `,
            [Askid]
        );

        res.json({ topic: topic[0], comments });
    } catch (err) {
        console.error("[GET /forum/:Askid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   POST /forum
   - user เท่านั้น
   - multipart: Asktopic, Askdetails, images[]
================================== */
router.post("/", verifyToken, uploadForumImage.array("images", 6), async (req: Request, res: Response) => {
    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if (!isUserToken(u)) return res.status(403).json({ error: "Only user can create topic" });

    const Asktopic = String(req.body?.Asktopic ?? "").trim();
    const Askdetails = String(req.body?.Askdetails ?? "").trim();
    if (!Asktopic || !Askdetails) return res.status(400).json({ error: "Missing fields" });

    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const imgPaths = files.map((f) => `/public/forum/${f.filename}`);
        const Askimages = imgPaths.length ? JSON.stringify(imgPaths) : null;

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO questions (Cid, Asktopic, Askdetails, Askimages) VALUES (?, ?, ?, ?)`,
            [u.Cid, Asktopic, Askdetails, Askimages]
        );

        res.json({ success: true, Askid: result.insertId });
    } catch (err) {
        console.error("[POST /forum] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   POST /forum/:Askid/reply
   - user/admin ตอบได้
   - multipart: Replydetails, images[]
================================== */
router.post("/:Askid/reply", verifyToken, uploadForumImage.array("images", 6), async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    if (isNaN(Askid)) return res.status(400).json({ error: "Invalid Askid" });

    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });

    const Replydetails = String(req.body?.Replydetails ?? "").trim();
    if (!Replydetails) return res.status(400).json({ error: "Missing reply" });

    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const imgPaths = files.map((f) => `/public/forum/${f.filename}`);
        const Replyimages = imgPaths.length ? JSON.stringify(imgPaths) : null;

        // ✅ admin reply
        if (isAdminToken(u)) {
            const [result] = await pool.query<ResultSetHeader>(
                `
        INSERT INTO replies (Askid, Cid, Adminid, Replyrole, Replydetails, Replyimages)
        VALUES (?, NULL, ?, 'admin', ?, ?)
        `,
                [Askid, u.Aid, Replydetails, Replyimages]
            );
            return res.json({ success: true, Replyid: result.insertId });
        }

        // ✅ user reply
        const [result] = await pool.query<ResultSetHeader>(
            `
      INSERT INTO replies (Askid, Cid, Adminid, Replyrole, Replydetails, Replyimages)
      VALUES (?, ?, NULL, 'user', ?, ?)
      `,
            [Askid, u.Cid, Replydetails, Replyimages]
        );

        res.json({ success: true, Replyid: result.insertId });
    } catch (err) {
        console.error("[POST /forum/:Askid/reply] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   PUT /forum/:Askid
   - owner (user) แก้ได้
================================== */
router.put("/:Askid", verifyToken, async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);
    const Asktopic = String(req.body?.Asktopic ?? "").trim();
    const Askdetails = String(req.body?.Askdetails ?? "").trim();

    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if (!isUserToken(u)) return res.status(403).json({ error: "Forbidden" });

    try {
        const [owner] = await pool.query<RowDataPacket[]>("SELECT Cid FROM questions WHERE Askid = ?", [Askid]);
        if (owner.length === 0) return res.status(404).json({ error: "Topic not found" });
        if (owner[0].Cid !== u.Cid) return res.status(403).json({ error: "Forbidden" });

        await pool.query("UPDATE questions SET Asktopic = ?, Askdetails = ? WHERE Askid = ?", [
            Asktopic,
            Askdetails,
            Askid,
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error("[PUT /forum/:Askid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ==================================
   DELETE /forum/:Askid
   - owner (user) ลบได้
   - replies จะโดนลบเองเพราะ FK ON DELETE CASCADE
================================== */
router.delete("/:Askid", verifyToken, async (req: Request, res: Response) => {
    const Askid = Number(req.params.Askid);

    const u = getAuth(req);
    if (!u) return res.status(401).json({ error: "Unauthorized" });
    if (!isUserToken(u)) return res.status(403).json({ error: "Forbidden" });

    try {
        const [rows] = await pool.query<RowDataPacket[]>("SELECT Cid FROM questions WHERE Askid = ?", [Askid]);
        if (rows.length === 0) return res.status(404).json({ error: "Topic not found" });
        if (rows[0].Cid !== u.Cid) return res.status(403).json({ error: "Forbidden" });

        await pool.query("DELETE FROM questions WHERE Askid = ?", [Askid]);
        res.json({ success: true });
    } catch (err) {
        console.error("[DELETE /forum/:Askid] ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

export default router;
