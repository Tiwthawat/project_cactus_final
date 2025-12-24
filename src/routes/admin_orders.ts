import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";
import { verifyToken } from "../middlewares/auth";
import { onlyAdmin } from "../middlewares/onlyAdmin";

const router = Router();

interface AuctionOrderRow extends RowDataPacket {
    Aid: number;
    PROid: number;
    PROname: string;
    winner_id: number;
    current_price: number;
    PROstatus: string;
    Cname: string;
}
router.use(verifyToken, onlyAdmin);

router.get("/auction-orders", async (req, res) => {
    try {
        const [rows] = await pool.query<AuctionOrderRow[]>(`
      SELECT 
        a.Aid,
        a.PROid,
        p.PROname,
        a.payment_status,
        p.shipping_status,
        a.current_price,
        c.Cname,
        c.Cid AS winner_id
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      JOIN customers c ON a.winner_id = c.Cid
      WHERE a.winner_id IS NOT NULL
      ORDER BY a.Aid DESC
    `);

        res.json(rows);
    } catch (err) {
        console.error("❌ ERROR GET auction-orders:", err);
        res.status(500).json({ message: "โหลดข้อมูลล้มเหลว" });
    }
});

// อัปเดตสถานะสินค้า (PROstatus)
router.put("/auction-orders/:Aid", async (req, res) => {
    const { Aid } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: "ต้องระบุ status" });
    }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            `UPDATE auction_products 
       SET PROstatus = ?
       WHERE PROid = (SELECT PROid FROM auctions WHERE Aid = ?)`,
            [status, Aid]
        );

        res.json({ message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
        console.error("❌ UPDATE auction order:", err);
        res.status(500).json({ message: "อัปเดตสถานะล้มเหลว" });
    }
});

router.get("/auction-orders/:Aid", async (req, res) => {
    const { Aid } = req.params;

    try {
        const conn = await pool.getConnection();

        // ⭐ JOIN เอาข้อมูลจัดส่งมาด้วย
        const [rows] = await conn.query<RowDataPacket[]>(
            `
      SELECT
  a.Aid,
  a.PROid,
  a.winner_id,
  a.current_price,

  p.PROname,
  p.PROpicture,
  p.PROstatus,

  c.Cname,
  c.Cphone,
  CONCAT(c.Caddress, ' ', c.Csubdistrict, ' ', c.Cdistrict, ' ',
         c.Cprovince, ' ', c.Czipcode) AS Caddress,

  -- ⭐⭐⭐ ดึงจาก auction_products ไม่ใช่ auctions
  p.shipping_company,
  p.tracking_number,
  p.shipping_status

FROM auctions a
JOIN auction_products p ON a.PROid = p.PROid
JOIN customers c ON a.winner_id = c.Cid
WHERE a.Aid = ?

      `,
            [Aid]
        );

        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ message: "ไม่พบรอบประมูลนี้" });
        }

        const info = rows[0];

        // ดึงข้อมูลการชำระล่าสุด
        const [pay] = await conn.query<RowDataPacket[]>(
            `
      SELECT *
      FROM auction_payments
      WHERE Aid = ?
      ORDER BY Payid DESC
      LIMIT 1
      `,
            [Aid]
        );

        conn.release();

        return res.json({
            Aid: info.Aid,
            PROid: info.PROid,
            PROname: info.PROname,
            PROpicture: info.PROpicture,
            PROstatus: info.PROstatus,

            Cname: info.Cname,
            Cphone: info.Cphone,
            Caddress: info.Caddress,

            current_price: info.current_price,

            amount: pay[0]?.amount ?? null,
            slip: pay[0]?.slip ?? null,
            paid_at: pay[0]?.paid_at ?? null,
            payment_status: pay[0]?.status ?? null,

            // ⭐⭐ ส่งข้อมูลจัดส่งกลับให้หน้าเว็บ
            shipping_company: info.shipping_company,
            tracking_number: info.tracking_number,
            shipping_status: info.shipping_status,
        });

    } catch (err) {
        console.error("❌ GET auction order detail error:", err);
        return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
});




/* ========================================================
   2) PUT เปลี่ยนสถานะออเดอร์ประมูล (Admin)
   URL: PUT /admin/auction-orders/:Aid/status
======================================================== */
router.patch("/auction-orders/:Aid/status", async (req, res) => {
    const { Aid } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ message: "ต้องระบุสถานะ" });

    try {
        // update auction_payments
        await pool.query(
            `
      UPDATE auction_payments
      SET status = ?
      WHERE Payid = (
        SELECT Payid FROM (
          SELECT Payid FROM auction_payments
          WHERE Aid = ?
          ORDER BY Payid DESC
          LIMIT 1
        ) t
      )
    `,
            [status, Aid]
        );

        // update auctions
        await pool.query(
            `UPDATE auctions SET payment_status = ? WHERE Aid = ?`,
            [status, Aid]
        );

        // update auction_products (optional)
        await pool.query(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET p.PROstatus = ?
      WHERE a.Aid = ?
      `,
            [status, Aid]
        );

        return res.json({ message: "อัปเดตสถานะสำเร็จ" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "ผิดพลาด" });
    }
});



// ยืนยันชำระเงินแล้ว (Admin)
router.patch("/admin/auctions/:Aid/payment", async (req, res) => {
    const { Aid } = req.params;

    try {
        const conn = await pool.getConnection();

        // 1) update auction_payments ล่าสุด
        await conn.query(
            `
      UPDATE auction_payments
      SET status = 'paid'
      WHERE Payid = (
        SELECT Payid FROM (
          SELECT Payid 
          FROM auction_payments
          WHERE Aid = ?
          ORDER BY Payid DESC
          LIMIT 1
        ) AS t
      )
      `,
            [Aid]
        );

        // 2) update ในตาราง auctions
        await conn.query(
            `UPDATE auctions SET payment_status = 'paid' WHERE Aid = ?`,
            [Aid]
        );

        conn.release();

        return res.json({ message: "อัปเดตชำระเงินสำเร็จ" });
    } catch (err) {
        console.error("❌ ERROR update payment:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});

// PATCH: บันทึกข้อมูลจัดส่งสินค้า
router.patch("/auction-orders/:Aid/shipping", async (req, res) => {
    const { Aid } = req.params;
    const { shipping_company, tracking_number } = req.body;

    if (!shipping_company || !tracking_number)
        return res.status(400).json({ message: "ต้องกรอกข้อมูลให้ครบ" });

    try {
        await pool.query(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET 
        p.shipping_company = ?,
        p.tracking_number = ?,
        p.shipping_status = 'shipped'
      WHERE a.Aid = ?
    `,
            [shipping_company, tracking_number, Aid]
        );

        return res.json({ message: "บันทึกจัดส่งแล้ว" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "ผิดพลาด" });
    }
});



// Admin → บังคับปิดสถานะเป็น delivered
router.patch("/auction-orders/:Aid/delivered", async (req, res) => {
    try {
        const { Aid } = req.params;

        await pool.query(`
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET p.shipping_status = 'delivered'
      WHERE a.Aid = ?
    `, [Aid]);

        return res.json({ message: "อัปเดตเป็น delivered แล้ว" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});
export default router;
