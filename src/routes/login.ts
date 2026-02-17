import bcrypt from "bcryptjs";
import { NextFunction, Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { FieldPacket, RowDataPacket } from "mysql2";
import { pool } from "../app";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "cactus-secret-123";

/** ---------- Types ---------- */
interface LoginBody {
  Cusername?: string;
  Cpassword?: string;
  username?: string;
  password?: string;
}

interface AdminRow extends RowDataPacket {
  Aid: number;
  Ausername: string | null;
  Apassword: string | null;
  Aname: string | null;
}

interface CustomerRow extends RowDataPacket {
  Cid: number;
  Cusername: string;
  Cpassword: string;
  Cname: string;
  Cstatus: string;
}

interface LoginResponseBase {
  message: string;
  token: string;
  role: "admin" | "user";
}
interface CustomerPhoneRow extends RowDataPacket {
  Cid: number;
  Cusername: string;
  Cphone: string;
}



/** ---------- Helper ---------- */
function pickCredentials(body: LoginBody): { username: string; password: string } | null {
  const username = body.Cusername ?? body.username;
  const password = body.Cpassword ?? body.password;

  if (typeof username !== "string" || typeof password !== "string") return null;
  if (!username.trim() || !password.trim()) return null;

  return { username: username.trim(), password: password.trim() };
}

function isBcryptHash(value: string): boolean {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

/** ---------- POST /login (admin+user) ---------- */
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  const creds = pickCredentials(req.body as LoginBody);
  if (!creds) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  const { username, password } = creds;

  try {
    const conn = await pool.getConnection();
    try {
      // 1) เช็ค admin ก่อน
      const [adminRows]: [AdminRow[], FieldPacket[]] = await conn.query(
        "SELECT Aid, Ausername, Apassword, Aname FROM admin WHERE Ausername = ? LIMIT 1",
        [username]
      );

      if (adminRows.length > 0) {
        const admin = adminRows[0];
        const stored = admin.Apassword ?? "";

        let ok = false;
        if (stored && isBcryptHash(stored)) {
          ok = await bcrypt.compare(password, stored);
        } else {
          // ✅ รองรับกรณีเก่าที่เป็น plain text
          ok = stored === password;
        }

        if (!ok) return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });

        const token = jwt.sign(
          { role: "admin", Aid: admin.Aid, Ausername: admin.Ausername ?? "" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        const resp: LoginResponseBase & {
          admin: { Aid: number; Ausername: string; Aname: string | null };
        } = {
          message: "เข้าสู่ระบบสำเร็จ",
          token,
          role: "admin",
          admin: {
            Aid: admin.Aid,
            Ausername: admin.Ausername ?? "",
            Aname: admin.Aname ?? null,
          },
        };

        return res.status(200).json(resp);
      }

      // 2) ถ้าไม่ใช่ admin → เช็ค customers
      const [custRows]: [CustomerRow[], FieldPacket[]] = await conn.query(
        "SELECT Cid, Cusername, Cpassword, Cname, Cstatus FROM customers WHERE Cusername = ? LIMIT 1",
        [username]
      );

      if (custRows.length === 0) {
        return res.status(401).json({ message: "ไม่พบผู้ใช้งานนี้" });
      }

      const user = custRows[0];
      // ✅ ถ้าโดนแบน ห้ามล็อกอิน
      if (user.Cstatus === "banned") {
        return res.status(403).json({ message: "บัญชีถูกระงับการใช้งาน" });
      }

      const ok = await bcrypt.compare(password, user.Cpassword);
      if (!ok) return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });

      const token = jwt.sign(
        { role: "user", Cid: user.Cid, Cusername: user.Cusername, Cstatus: user.Cstatus },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      const resp: LoginResponseBase & {
        user: Omit<CustomerRow, "Cpassword">;
      } = {
        message: "เข้าสู่ระบบสำเร็จ",
        token,
        role: "user",
        user: {
          Cid: user.Cid,
          Cusername: user.Cusername,
          Cname: user.Cname,
          Cstatus: user.Cstatus,
        },
      };

      return res.status(200).json(resp);
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});



router.post('/auth/forgot-password', async (req, res) => {
  try {
    const { username, phone } = req.body;

    if (!username || !phone) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และเบอร์โทร' });
    }

    const [rows] = await pool.query<CustomerPhoneRow[]>(
      `SELECT Cid, Cusername, Cphone 
       FROM customers 
       WHERE Cusername = ? AND Cphone = ?
       LIMIT 1`,
      [username, phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งานนี้หรือเบอร์โทรไม่ถูกต้อง' });
    }

    const user = rows[0];

    // ⭐ ออก resetToken อายุ 15 นาที
    const resetToken = jwt.sign(
      {
        Cid: user.Cid,
        type: "password_reset",
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      message: "ยืนยันตัวตนสำเร็จ กรุณาตั้งรหัสผ่านใหม่",
      resetToken,
    });

  } catch (error) {
    console.error("forgot-password error:", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }

    let payload: any;
    try {
      payload = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'โทเคนหมดอายุหรือไม่ถูกต้อง' });
    }

    if (payload.type !== "password_reset") {
      return res.status(401).json({ message: "โทเคนประเภทไม่ถูกต้อง" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE customers SET Cpassword = ? WHERE Cid = ?`,
      [hashed, payload.Cid]
    );

    return res.json({ message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });

  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดในระบบ" });
  }
});

export default router;
