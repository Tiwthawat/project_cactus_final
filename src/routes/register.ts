import bcrypt from "bcryptjs";
import { Router } from "express";
import { pool } from "../app";
import { uploadProfilePicture } from '../middlewares/upload';


const router = Router();

router.post(
  "/register",
  uploadProfilePicture.single('profile'),
  async (req, res, next) => {
    const {
      Cname,
      Caddress,
      Csubdistrict,
      Cdistrict,
      Cprovince,
      Czipcode,
      Cusername,
      Cpassword,
      Cphone,
      Cbirth,
    } = req.body;

    const Cprofile = req.file?.filename || null;

    if (
      !Cname || !Caddress || !Csubdistrict || !Cdistrict || !Cprovince ||
      !Czipcode || !Cusername || !Cpassword || !Cphone || !Cbirth
    ) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
      const connection = await pool.getConnection();
      try {
        const [userRows]: any = await connection.query(
          "SELECT Cid FROM customers WHERE Cusername = ?",
          [Cusername]
        );
        if (userRows.length > 0) {
          return res.status(409).json({ message: "ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว" });
        }

        const [nameRows]: any = await connection.query(
          "SELECT Cid FROM customers WHERE Cname = ?",
          [Cname]
        );
        if (nameRows.length > 0) {
          return res.status(409).json({ message: "ชื่อจริงนี้เคยลงทะเบียนแล้ว" });
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
            Cname, Caddress, Csubdistrict, Cdistrict, Cprovince, Czipcode,
            Cusername, hashedPassword, Cphone, Cbirth, Cprofile
          ]
        );

        return res.status(201).json({ message: "สมัครสมาชิกสำเร็จ" });
      } catch (error) {
        next(error);
      } finally {
        connection.release();
      }

    } catch (error) {
      next(error);
    }
  }
);


export default router;
