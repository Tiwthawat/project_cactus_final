import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";

import { verifyToken } from "../middlewares/auth";
import { onlyAdmin } from "../middlewares/onlyAdmin";
import { createNotification } from "../utils/notify";

const router = Router();

interface AuctionOrderListRow extends RowDataPacket {
    Aid: number;
    PROid: number;
    PROname: string;
    payment_status: string;
    shipping_status: string | null;
    current_price: number;
    Cname: string;
    winner_id: number;
    end_time: string | null;
    paid_at: string | null;
}

type AuctionPaymentStatus = "pending_payment" | "paid" | "rejected" | "expired";
type AuctionShippingStatus = "pending" | "shipping" | "delivered" | null;

function isAuctionPaymentStatus(v: unknown): v is AuctionPaymentStatus {
    return v === "pending_payment" || v === "paid" || v === "rejected" || v === "expired";
}

async function getAuctionContext(Aid: number): Promise<{
    Aid: number;
    PROid: number;
    PROname: string;
    winner_id: number;
    Cname: string;
} | null> {
    const [rows] = await pool.query<
        Array<
            RowDataPacket & {
                Aid: number;
                PROid: number;
                PROname: string;
                winner_id: number;
                Cname: string;
            }
        >
    >(
        `
    SELECT 
      a.Aid,
      a.PROid,
      p.PROname,
      a.winner_id,
      c.Cname
    FROM auctions a
    JOIN auction_products p ON a.PROid = p.PROid
    JOIN customers c ON a.winner_id = c.Cid
    WHERE a.Aid = ?
      AND a.winner_id IS NOT NULL
    LIMIT 1
    `,
        [Aid]
    );

    return rows.length ? rows[0] : null;
}

router.use(verifyToken, onlyAdmin);

router.get("/auction-orders", async (req, res) => {
    try {
        const hasYear = typeof req.query.year !== "undefined";
        let dateFilter = "";
        const params: Array<string | number> = [];

        if (hasYear) {
            const year = Number(req.query.year);

            if (!Number.isFinite(year) || year < 2000 || year > 3000) {
                return res.status(400).json({ message: "year ไม่ถูกต้อง" });
            }

            const start = `${year}-01-01 00:00:00`;
            const end = `${year + 1}-01-01 00:00:00`;

            dateFilter = ` AND a.end_time >= ? AND a.end_time < ?`;
            params.push(start, end);
        }

        const [rows] = await pool.query<AuctionOrderListRow[]>(
            `
      SELECT 
        a.Aid,
        a.PROid,
        p.PROname,
        a.payment_status,
        p.shipping_status,
        a.current_price,
        c.Cname,
        c.Cid AS winner_id,
        a.end_time,
        (
          SELECT ap.paid_at
          FROM auction_payments ap
          WHERE ap.Aid = a.Aid
          ORDER BY ap.paid_at DESC, ap.Payid DESC
          LIMIT 1
        ) AS paid_at
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      JOIN customers c ON a.winner_id = c.Cid
      WHERE a.winner_id IS NOT NULL
        AND a.end_time IS NOT NULL
      ${dateFilter}
      ORDER BY a.end_time DESC, a.Aid DESC
      `,
            params
        );

        return res.json(rows);
    } catch (err) {
        console.error("ERROR GET auction-orders:", err);
        return res.status(500).json({ message: "โหลดข้อมูลล้มเหลว" });
    }
});

// อัปเดตสถานะสินค้า (PROstatus)
router.put("/auction-orders/:Aid", async (req, res) => {
    const Aid = Number(req.params.Aid);
    const { status } = req.body as { status?: string };

    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });
    if (!status) return res.status(400).json({ message: "ต้องระบุ status" });

    try {
        await pool.query<ResultSetHeader>(
            `UPDATE auction_products 
       SET PROstatus = ?
       WHERE PROid = (SELECT PROid FROM auctions WHERE Aid = ?)`,
            [status, Aid]
        );

        return res.json({ message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
        console.error("UPDATE auction order:", err);
        return res.status(500).json({ message: "อัปเดตสถานะล้มเหลว" });
    }
});

router.get("/auction-orders/:Aid", async (req, res) => {
    const Aid = Number(req.params.Aid);
    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });

    try {
        const conn = await pool.getConnection();

        const [rows] = await conn.query<
            Array<
                RowDataPacket & {
                    Aid: number;
                    PROid: number;
                    winner_id: number;
                    current_price: number;

                    PROname: string;
                    PROpicture: string | null;
                    PROstatus: string | null;

                    Cname: string;
                    Cphone: string | null;
                    Caddress: string | null;

                    shipping_company: string | null;
                    tracking_number: string | null;
                    shipping_status: AuctionShippingStatus;
                }
            >
        >(
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
        CONCAT(
          c.Caddress, ' ', c.Csubdistrict, ' ', c.Cdistrict, ' ',
          c.Cprovince, ' ', c.Czipcode
        ) AS Caddress,

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

        const [pay] = await conn.query<
            Array<
                RowDataPacket & {
                    amount: number | null;
                    slip: string | null;
                    paid_at: string | null;
                    status: AuctionPaymentStatus | string | null;
                }
            >
        >(
            `
      SELECT amount, slip, paid_at, status
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

            shipping_company: info.shipping_company,
            tracking_number: info.tracking_number,
            shipping_status: info.shipping_status,
        });
    } catch (err) {
        console.error("GET auction order detail error:", err);
        return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
    }
});

/* ========================================================
   PATCH เปลี่ยนสถานะชำระเงินออเดอร์ประมูล (Admin)
   URL: PATCH /admin/auction-orders/:Aid/status
======================================================== */
router.patch("/auction-orders/:Aid/status", async (req, res) => {
    const Aid = Number(req.params.Aid);
    const { status } = req.body as { status?: unknown };

    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });
    if (!isAuctionPaymentStatus(status)) return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });

    try {
        // update auction_payments (ล่าสุด)
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
        await pool.query(`UPDATE auctions SET payment_status = ? WHERE Aid = ?`, [status, Aid]);

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

        // notify winner
        const ctx = await getAuctionContext(Aid);
        if (ctx) {
            if (status === "paid") {
                await createNotification({
                    customerId: ctx.winner_id,
                    type: "payment_approved",
                    title: "ยืนยันการชำระเงินสำเร็จ",
                    body: `การชำระเงินประมูล "${ctx.PROname}" ได้รับการยืนยันแล้ว`,
                    link: `/me/auction-wins/${ctx.Aid}`,
                });
            } else if (status === "rejected") {
                await createNotification({
                    customerId: ctx.winner_id,
                    type: "payment_rejected",
                    title: "การชำระเงินถูกปฏิเสธ",
                    body: `กรุณาตรวจสอบสลิปและอัปโหลดใหม่สำหรับ "${ctx.PROname}"`,
                    link: `/me/auction-wins/${ctx.Aid}`,
                });
            } else if (status === "expired") {
                await createNotification({
                    customerId: ctx.winner_id,
                    type: "auction_lost",
                    title: "หมดเวลาชำระเงินประมูล",
                    body: `คุณไม่ได้ชำระเงินภายในเวลาที่กำหนดสำหรับ "${ctx.PROname}"`,
                    link: `/me/auction-wins`,
                });
            }
        }

        return res.json({ message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
        console.error("PATCH auction payment status error:", err);
        return res.status(500).json({ message: "ผิดพลาด" });
    }
});

// ยืนยันชำระเงินแล้ว (Admin)
router.patch("/admin/auctions/:Aid/payment", async (req, res) => {
    const Aid = Number(req.params.Aid);
    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });

    try {
        const conn = await pool.getConnection();

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

        await conn.query(`UPDATE auctions SET payment_status = 'paid' WHERE Aid = ?`, [Aid]);

        conn.release();

        const ctx = await getAuctionContext(Aid);
        if (ctx) {
            await createNotification({
                customerId: ctx.winner_id,
                type: "payment_approved",
                title: "ยืนยันการชำระเงินสำเร็จ",
                body: `การชำระเงินประมูล "${ctx.PROname}" ได้รับการยืนยันแล้ว`,
                link: `/me/auction-wins/${ctx.Aid}`,
            });
        }

        return res.json({ message: "อัปเดตชำระเงินสำเร็จ" });
    } catch (err) {
        console.error("ERROR update payment:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});

// PATCH: บันทึกข้อมูลจัดส่งสินค้า
router.patch("/auction-orders/:Aid/shipping", async (req, res) => {
    const Aid = Number(req.params.Aid);
    const { shipping_company, tracking_number } = req.body as {
        shipping_company?: string;
        tracking_number?: string;
    };

    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });
    if (!shipping_company || !tracking_number) return res.status(400).json({ message: "ต้องกรอกข้อมูลให้ครบ" });

    try {
        await pool.query(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET 
        p.shipping_company = ?,
        p.tracking_number = ?,
        p.shipping_status = 'shipping'
      WHERE a.Aid = ?
      `,
            [shipping_company, tracking_number, Aid]
        );

        const ctx = await getAuctionContext(Aid);
        if (ctx) {
            await createNotification({
                customerId: ctx.winner_id,
                type: "order_shipped",
                title: "จัดส่งสินค้าแล้ว",
                body: `สินค้า "${ctx.PROname}" ถูกจัดส่งแล้ว เลขพัสดุ: ${tracking_number}`,
                link: `/me/auction-wins/${ctx.Aid}`,
            });
        }

        return res.json({ message: "บันทึกจัดส่งแล้ว" });
    } catch (err) {
        console.error("PATCH shipping error:", err);
        return res.status(500).json({ message: "ผิดพลาด" });
    }
});

// Admin → บังคับปิดสถานะเป็น delivered
router.patch("/auction-orders/:Aid/delivered", async (req, res) => {
    const Aid = Number(req.params.Aid);
    if (!Number.isFinite(Aid)) return res.status(400).json({ message: "Aid ไม่ถูกต้อง" });

    try {
        await pool.query(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET p.shipping_status = 'delivered'
      WHERE a.Aid = ?
      `,
            [Aid]
        );

        const ctx = await getAuctionContext(Aid);
        if (ctx) {
            await createNotification({
                customerId: ctx.winner_id,
                type: "order_delivered",
                title: "ส่งมอบสินค้าเรียบร้อย",
                body: `สินค้า "${ctx.PROname}" ถูกส่งมอบเรียบร้อยแล้ว`,
                link: `/me/auction-wins/${ctx.Aid}`,
            });
        }

        return res.json({ message: "อัปเดตเป็น delivered แล้ว" });
    } catch (err) {
        console.error("PATCH delivered error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});

// Admin → เช็คคนชนะที่ยัง pending_payment เกิน 24 ชม. แล้วแบน
router.post("/auction-orders/check-expired", async (req, res) => {
    try {
        const conn = await pool.getConnection();

        const [rows] = await conn.query<Array<RowDataPacket & { Aid: number; winner_id: number }>>(
            `
      SELECT a.Aid, a.winner_id
      FROM auctions a
      WHERE a.winner_id IS NOT NULL
        AND a.end_time IS NOT NULL
        AND a.payment_status = 'pending_payment'
        AND a.end_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
      `
        );

        if (rows.length === 0) {
            conn.release();
            return res.json({ message: "ไม่มีรายการหมดเวลา", banned: 0, expired: 0 });
        }

        const aids = rows.map((r) => r.Aid);
        const winners = rows.map((r) => r.winner_id);

        await conn.query(
            `
      UPDATE customers
      SET Cstatus = 'banned'
      WHERE Cid IN (${winners.map(() => "?").join(",")})
        AND (Cstatus IS NULL OR Cstatus <> 'banned')
      `,
            winners
        );

        await conn.query(
            `
      UPDATE auctions
      SET payment_status = 'expired'
      WHERE Aid IN (${aids.map(() => "?").join(",")})
      `,
            aids
        );

        conn.release();

        // notify: รายตัว (กันข้อความรวมมั่ว)
        for (const row of rows) {
            const ctx = await getAuctionContext(row.Aid);
            if (!ctx) continue;

            await createNotification({
                customerId: ctx.winner_id,
                type: "auction_lost",
                title: "หมดเวลาชำระเงินประมูล",
                body: `คุณไม่ได้ชำระเงินภายใน 24 ชั่วโมงสำหรับ "${ctx.PROname}" ระบบยกเลิกสิทธิ์ผู้ชนะ`,
                link: `/me/auction-wins`,
            });
        }

        return res.json({
            message: "จัดการหมดเวลาแล้ว",
            banned: winners.length,
            expired: aids.length,
            aids,
        });
    } catch (err) {
        console.error("check-expired error:", err);
        return res.status(500).json({ message: "ผิดพลาด" });
    }
});

export default router;