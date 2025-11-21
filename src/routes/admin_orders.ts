import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";

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

router.get("/auction-orders", async (req, res) => {
    try {
        const [rows] = await pool.query<AuctionOrderRow[]>(`
      SELECT 
        a.Aid,
        a.PROid,
        p.PROname,
        p.PROstatus,
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

        // ดึงข้อมูลสินค้า + รอบประมูล + ผู้ชนะ
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
        CONCAT(c.Caddress, ' ', c.Csubdistrict, ' ', c.Cdistrict, ' ', c.Cprovince, ' ', c.Czipcode) AS Caddress

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
router.put("/auction-orders/:Aid/status", async (req, res) => {
    const { Aid } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: "ต้องระบุสถานะใหม่" });
    }

    try {
        const conn = await pool.getConnection();

        // 1) UPDATE auction_products (ถ้าอยากให้เปลี่ยนสถานะด้วย)
        await conn.query(
            `
            UPDATE auction_products p
            JOIN auctions a ON a.PROid = p.PROid
            SET p.PROstatus = ?
            WHERE a.Aid = ?
            `,
            [status, Aid]
        );

        // 2) UPDATE auction_payments (สถานะล่าสุด)
        await conn.query(
            `
            UPDATE auction_payments
            SET status = ?
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
            [status, Aid]
        );

        // ⭐ 3) UPDATE auctions.payment_status ← จุดที่หายไป
        await conn.query(
            `UPDATE auctions SET payment_status = ? WHERE Aid = ?`,
            [status, Aid]
        );

        conn.release();
        return res.json({ message: "อัปเดตสถานะสำเร็จ" });

    } catch (err) {
        console.error("❌ UPDATE auction status error:", err);
        return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
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
router.patch("/admin/auction-products/:PROid/shipping", async (req, res) => {
    try {
        const { PROid } = req.params;
        const { shipping_company, tracking_number, shipping_status } = req.body;

        if (!shipping_company || !tracking_number) {
            return res.status(400).json({ error: "ต้องกรอกขนส่งและเลขพัสดุ" });
        }

        const [result] = await pool.query<ResultSetHeader>(
            `
    UPDATE auction_products
    SET 
      shipping_company = ?,
      tracking_number = ?,
      shipping_status = ?
    WHERE PROid = ?
  `,
            [
                shipping_company,
                tracking_number,
                shipping_status || "shipped",
                PROid,
            ]
        );


        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "ไม่พบสินค้า หรืออัปเดตไม่สำเร็จ" });
        }

        res.json({ message: "บันทึกข้อมูลจัดส่งสำเร็จ" });
    } catch (err) {
        console.error("❌ ERROR: update shipping", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Admin → บังคับปิดสถานะเป็น delivered
router.patch("/admin/auction-orders/:Aid/delivered", async (req, res) => {
    try {
        const { Aid } = req.params;

        // อัปเดต shipping_status
        await pool.query<ResultSetHeader>(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET p.shipping_status = 'delivered'
      WHERE a.Aid = ?
      `,
            [Aid]
        );

        return res.json({ message: "อัปเดตเป็นจัดส่งสำเร็จ (delivered)" });

    } catch (err) {
        console.error("❌ ERROR admin delivered:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});








export default router;
