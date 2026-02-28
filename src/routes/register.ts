import bcrypt from "bcryptjs";
import { Router } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../app";
import { uploadProfilePicture } from "../middlewares/upload";

const router = Router();

type MysqlErrLike = {
  code?: string;
  message?: string;
};

function isMysqlErrLike(e: unknown): e is MysqlErrLike {
  return typeof e === "object" && e !== null;
}

interface IdRow extends RowDataPacket {
  Cid: number;
}

router.post(
  "/register",
  uploadProfilePicture.single("profile"),
  async (req, res, next) => {
    const {
      Cname,
      Caddress,
      Csubdistrict,
      Cdistrict,
      Cprovince,
      Czipcode,
      Cusername, // ใช้เป็นอีเมล
      Cpassword,
      Cphone,
      Cbirth,
    } = req.body as Record<string, string | undefined>;

    const Cprofile = req.file?.filename ?? null;

    if (
      !Cname ||
      !Caddress ||
      !Csubdistrict ||
      !Cdistrict ||
      !Cprovince ||
      !Czipcode ||
      !Cusername ||
      !Cpassword ||
      !Cphone ||
      !Cbirth
    ) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
      const connection = await pool.getConnection();

      try {
        // 1) email/username ซ้ำไหม
        const [userRows] = await connection.query<IdRow[]>(
          "SELECT Cid FROM customers WHERE Cusername = ? LIMIT 1",
          [Cusername]
        );
        if (userRows.length > 0) {
          return res.status(409).json({ message: "อีเมลนี้ถูกใช้ไปแล้ว" });
        }

        // 2) phone ซ้ำไหม (เพื่อให้ตอบ 409 แบบสวย ๆ ไม่ใช่ 500)
        const [phoneRows] = await connection.query<IdRow[]>(
          "SELECT Cid FROM customers WHERE Cphone = ? LIMIT 1",
          [Cphone]
        );
        if (phoneRows.length > 0) {
          return res.status(409).json({ message: "เบอร์โทรนี้ถูกใช้แล้ว" });
        }

        const hashedPassword = await bcrypt.hash(Cpassword, 10);

        await connection.query(
          `
          INSERT INTO customers (
            Cname, Caddress, Csubdistrict, Cdistrict, Cprovince, Czipcode,
            Cusername, Cpassword, Cphone, Cbirth, Cstatus, Cdate, Cprofile
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', NOW(), ?)
          `,
          [
            Cname,
            Caddress,
            Csubdistrict,
            Cdistrict,
            Cprovince,
            Czipcode,
            Cusername,
            hashedPassword,
            Cphone,
            Cbirth,
            Cprofile,
          ]
        );

        return res.status(201).json({ message: "สมัครสมาชิกสำเร็จ" });
      } catch (error: unknown) {
        // กันเหนียว: ถ้าหลุดมาชน UNIQUE ใน DB (เช่น uq_customers_phone)
        if (isMysqlErrLike(error) && error.code === "ER_DUP_ENTRY") {
          const msg =
            typeof error.message === "string" &&
              error.message.includes("uq_customers_phone")
              ? "เบอร์โทรนี้ถูกใช้แล้ว"
              : "ข้อมูลนี้ถูกใช้ไปแล้ว";
          return res.status(409).json({ message: msg });
        }

        return next(error);
      } finally {
        connection.release();
      }
    } catch (error: unknown) {
      return next(error);
    }
  }
);

export default router;