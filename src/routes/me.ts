import { Request, Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../app";

// ✅ ใช้ verifyToken + types จาก middleware (อันใหม่ที่มี role)
import { AuthedRequest, CustomerTokenPayload, verifyToken } from "../middlewares/auth";

const router = Router();
const API_BASE = process.env.API_BASE_URL || "";

/* -------------------------
   Types
--------------------------*/
interface OrderRow extends RowDataPacket {
    Oid: number;
    Cid: number;
    receiver_name: string;
    receiver_phone: string;
    shipping_address: string;
    shipping_status: string;
    payment_status: string;
    created_at: string;

    // ถ้าคิวรี่จริงมีฟิลด์พวกนี้ด้วย ให้คงไว้
    Oprice?: number;
    Odate?: string;
    Ostatus?: string;
    Oslip?: string | null;
    Opayment?: string;
    Otracking?: string | null;
    Oshipping?: string;
}

interface OrderItemRow extends RowDataPacket {
    Pname: string;
    Ppicture: string | null;
    amount: number;
    price: number;
}

interface CustomerRow extends RowDataPacket {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    Cname: string;
    Caddress: string;
    Csubdistrict: string;
    Cdistrict: string;
    Cprovince: string;
    Czipcode: string;
    Cphone: string;
    Cdate: string;
    Cbirth: string;
    Cprofile: string;
}

interface AuctionWinRow extends RowDataPacket {
    Aid: number;
    current_price: number;
    status: string;
    end_time: string;

    PROid: number;
    PROname: string;
    PROpicture: string;
    PROstatus: string;

    payment_status: string;

    shipping_company: string | null;
    tracking_number: string | null;
    shipping_status: "pending" | "shipping" | "delivered" | null;
}

interface MyBiddingRow extends RowDataPacket {
    Aid: number;
    PROid: number;
    PROname: string;
    PROpicture: string | null;

    current_price: number;
    my_last_bid: number | null;

    auction_status: "open" | "closed";
    end_time: string;

    top_bidder_id: number | null;
}

interface MyBiddingItem {
    Aid: number;
    PROid: number;
    PROname: string;
    PROpicture: string | null;

    current_price: number;
    my_last_bid: number | null;

    status: "open" | "closed";
    my_status: "leading" | "outbid" | "won" | "lost";

    end_time: string;
}

/* -------------------------
   Helper — บังคับเป็น user
--------------------------*/
function requireUserFromReq(req: Request): CustomerTokenPayload | null {
    const u = (req as AuthedRequest).user;
    if (!u) return null;
    return u.role === "user" ? u : null;
}

/* -------------------------
   ทุก route ในไฟล์นี้ ต้อง login ก่อน
--------------------------*/
router.use(verifyToken);

/* -------------------------
   GET /me  (ข้อมูลผู้ใช้)
--------------------------*/
router.get("/", async (req, res, next) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const conn = await pool.getConnection();
        const [rows] = await conn.query<CustomerRow[]>(
            `
      SELECT 
        Cid, Cusername, Cstatus, Cname, Caddress, Csubdistrict, 
        Cdistrict, Cprovince, Czipcode, Cphone, Cdate, Cbirth, Cprofile
      FROM customers
      WHERE Cid = ?
      `,
            [decoded.Cid]
        );
        conn.release();

        if (rows.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
        res.json({ user: rows[0] });
    } catch (err) {
        next(err);
    }
});

/* ------------------------------------------
   GET /me/my-auction-wins  (รายการที่ชนะ)
-------------------------------------------*/
router.get("/my-auction-wins", async (req, res, next) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const userId = decoded.Cid;

        const [rows] = await pool.query<AuctionWinRow[]>(
            `
      SELECT
        a.Aid,
        a.current_price,
        a.status,
        a.end_time,
        p.PROid,
        p.PROname,
        p.PROpicture,
        p.PROstatus
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      WHERE a.winner_id = ?
        AND p.PROstatus IN ('pending_payment','payment_review','paid')
      ORDER BY a.Aid DESC
      `,
            [userId]
        );

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

/* --------------------------------------------------
   GET /me/my-auction-wins/:Aid   (รายละเอียดแต่ละรายการ)
---------------------------------------------------*/
router.get("/my-auction-wins/:Aid", async (req, res, next) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const userId = decoded.Cid;
        const { Aid } = req.params;

        const [rows] = await pool.query<AuctionWinRow[]>(
            `
      SELECT
        a.Aid,
        a.current_price,
        a.status,
        a.end_time,
        a.payment_status,

        p.PROid,
        p.PROname,
        p.PROpicture,
        p.PROstatus,

        p.shipping_company,
        p.tracking_number,
        p.shipping_status
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      WHERE a.Aid = ?
        AND a.winner_id = ?
      LIMIT 1
      `,
            [Aid, userId]
        );

        if (rows.length === 0) return res.status(404).json({ message: "ไม่พบข้อมูลรายการนี้" });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

/* --------------------------------------------------
   PATCH /me/my-auction-wins/:Aid/received (ผู้ใช้กดยืนยันรับสินค้า)
---------------------------------------------------*/
router.patch("/my-auction-wins/:Aid/received", async (req, res) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const userId = decoded.Cid;
        const { Aid } = req.params;

        const [chk] = await pool.query<RowDataPacket[]>(
            `SELECT Aid FROM auctions WHERE Aid = ? AND winner_id = ? LIMIT 1`,
            [Aid, userId]
        );

        if (chk.length === 0) {
            return res.status(403).json({ message: "ไม่สามารถยืนยันรายการนี้ได้" });
        }

        await pool.query(
            `
      UPDATE auction_products p
      JOIN auctions a ON a.PROid = p.PROid
      SET p.shipping_status = 'delivered'
      WHERE a.Aid = ?
      `,
            [Aid]
        );

        res.json({ message: "อัปเดตเป็นได้รับสินค้าแล้ว" });
    } catch (err) {
        console.error("❌ ERROR received:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

/* ------------------------------------------
   GET /me/my-bidding (รายการที่เคยบิด)
-------------------------------------------*/
router.get("/my-bidding", async (req, res, next) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const userId = decoded.Cid;

        const [rows] = await pool.query<MyBiddingRow[]>(
            `
      SELECT DISTINCT
        b.auction_id AS Aid,
        ap.PROid,
        ap.PROname,
        ap.PROpicture,
        a.current_price,

        (
          SELECT bd.amount
          FROM bids bd
          WHERE bd.auction_id = b.auction_id AND bd.user_id = ?
          ORDER BY bd.Bidid DESC
          LIMIT 1
        ) AS my_last_bid,

        a.status AS auction_status,
        a.end_time,

        (
          SELECT bd2.user_id
          FROM bids bd2
          WHERE bd2.auction_id = b.auction_id
          ORDER BY bd2.amount DESC, bd2.Bidid DESC
          LIMIT 1
        ) AS top_bidder_id

      FROM bids b
      JOIN auctions a ON a.Aid = b.auction_id
      JOIN auction_products ap ON ap.PROid = a.PROid
      WHERE b.user_id = ?
      ORDER BY a.end_time ASC
      `,
            [userId, userId]
        );

        const result: MyBiddingItem[] = rows.map((item) => {
            const my_status: MyBiddingItem["my_status"] =
                item.auction_status === "closed"
                    ? item.top_bidder_id === userId
                        ? "won"
                        : "lost"
                    : item.top_bidder_id === userId
                        ? "leading"
                        : "outbid";

            return {
                Aid: item.Aid,
                PROid: item.PROid,
                PROname: item.PROname,
                PROpicture: item.PROpicture ? `${API_BASE}${item.PROpicture}` : null,
                current_price: item.current_price,
                my_last_bid: item.my_last_bid,
                status: item.auction_status,
                my_status,
                end_time: item.end_time,
            };
        });

        res.json(result);
    } catch (err) {
        console.error("MY-BIDDING SQL ERROR =", err);
        next(err);
    }
});

/* -------------------------------------------------
   GET /me/orders/:id   (คำสั่งซื้อปกติ)
--------------------------------------------------*/
router.get("/orders/:id", async (req, res) => {
    try {
        const decoded = requireUserFromReq(req);
        if (!decoded) return res.status(403).json({ message: "User only" });

        const userId = decoded.Cid;
        const { id } = req.params;

        const [orders] = await pool.query<OrderRow[]>(
            `
      SELECT 
        Oid,
        Oprice,
        Odate,
        Ostatus,
        Oslip,
        Opayment,
        Otracking,
        Oshipping
      FROM orders
      WHERE Oid = ? AND Cid = ?
      LIMIT 1
      `,
            [id, userId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
        }

        const order = orders[0];

        const [items] = await pool.query<OrderItemRow[]>(
            `
      SELECT 
        oi.Oquantity AS amount,
        oi.Oprice AS price,
        p.Pname,
        p.Ppicture
      FROM order_items oi
      JOIN products p ON oi.Pid = p.Pid
      WHERE oi.Oid = ?
      `,
            [id]
        );

        return res.json({
            Oid: order.Oid,
            price: order.Oprice,
            date: order.Odate,
            status: order.Ostatus,
            slip: order.Oslip,
            payment: order.Opayment,
            tracking: order.Otracking,
            shipping: order.Oshipping,
            items: items || [],
        });
    } catch (err) {
        console.error("ORDER DETAIL ERROR:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});



export default router;
