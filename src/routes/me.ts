import { Request, Router } from "express";
import jwt from "jsonwebtoken";
import { RowDataPacket } from "mysql2";
import { pool } from "../app";

const router = Router();
const API_BASE = process.env.API_BASE_URL!;




/* -------------------------
   Types
--------------------------*/
interface TokenPayload {
    Cid: number;
    Cusername: string;
    Cstatus: string;
    iat: number;
    exp: number;
}

interface OrderRow extends RowDataPacket {
    Oid: number;
    Cid: number;
    receiver_name: string;
    receiver_phone: string;
    shipping_address: string;
    shipping_status: string;
    payment_status: string;
    created_at: string;
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

    payment_status: 'pending_payment' | 'paid' | string;

    shipping_company: string | null;
    tracking_number: string | null;
    shipping_status: 'pending' | 'shipped' | 'delivered' | null;
}

interface MyBiddingRow extends RowDataPacket {
    Aid: number;
    PROid: number;
    PROname: string;
    PROpicture: string | null;

    current_price: number;
    my_last_bid: number | null;

    auction_status: 'open' | 'closed';
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

    status: 'open' | 'closed';
    my_status: 'leading' | 'outbid' | 'won' | 'lost';

    end_time: string;
}




/* -------------------------
   Helper — แกะ token
--------------------------*/
function getUser(req: Request): TokenPayload | null {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return null;

    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    } catch {
        return null;
    }
}

/* -------------------------
   GET /me  (ข้อมูลผู้ใช้)
--------------------------*/
router.get("/me", async (req, res, next) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

        const conn = await pool.getConnection();
        const [rows] = await conn.query<CustomerRow[]>(
            `
      SELECT 
        Cid, Cusername, Cstatus, Cname, Caddress, Csubdistrict, 
        CDistrict, CProvince, Czipcode, Cphone, Cdate, Cbirth, Cprofile
      FROM customers
      WHERE Cid = ?
      `,
            [decoded.Cid]
        );
        conn.release();

        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบผู้ใช้" });

        res.json({ user: rows[0] });
    } catch (err) {
        next(err);
    }
});/* -------------------------
   GET /me  (ข้อมูลผู้ใช้)
--------------------------*/
router.get("/me", async (req, res, next) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

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

        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบผู้ใช้" });

        res.json({ user: rows[0] });
    } catch (err) {
        next(err);
    }
});

/* ------------------------------------------
   GET /me/my-auction-wins  (รายการที่ชนะ)
-------------------------------------------*/
router.get("/me/my-auction-wins", async (req, res, next) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

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
router.get("/me/my-auction-wins/:Aid", async (req, res, next) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

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

        if (rows.length === 0)
            return res.status(404).json({ message: "ไม่พบข้อมูลรายการนี้" });

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

router.patch("/me/my-auction-wins/:Aid/received", async (req, res) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

        const userId = decoded.Cid;
        const { Aid } = req.params;

        // ตรวจสอบก่อนว่าเป็นผู้ชนะจริงไหม
        const [chk] = await pool.query<RowDataPacket[]>(
            `SELECT Aid FROM auctions WHERE Aid = ? AND winner_id = ? LIMIT 1`,
            [Aid, userId]
        );


        if (chk.length === 0) {
            return res.status(403).json({ message: "ไม่สามารถยืนยันรายการนี้ได้" });
        }

        // อัปเดตสถานะจัดส่งเป็น delivered
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


router.get("/me/my-bidding", async (req, res, next) => {
    try {
        const decoded = getUser(req);
        if (!decoded) return res.status(401).json({ message: "Unauthorized" });

        const userId = decoded.Cid;

        const [rows] = await pool.query<MyBiddingRow[]>(`
      SELECT DISTINCT
          b.auction_id AS Aid,
          ap.PROid,
          ap.PROname,
          ap.PROpicture,
          a.current_price,

          -- ราคาที่ user คนนี้บิดล่าสุด
          (
              SELECT bd.amount
              FROM bids bd
              WHERE bd.auction_id = b.auction_id AND bd.user_id = ?
              ORDER BY bd.Bidid DESC
              LIMIT 1
          ) AS my_last_bid,

          a.status AS auction_status,
          a.end_time,

          -- ผู้บิดสูงสุดตอนนี้
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
    `, [userId, userId]);

        const result: MyBiddingItem[] = rows.map((item) => {
            let my_status: MyBiddingItem["my_status"];

            if (item.auction_status === "closed") {
                my_status = item.top_bidder_id === userId ? "won" : "lost";
            } else {
                my_status = item.top_bidder_id === userId ? "leading" : "outbid";
            }

            return {
                Aid: item.Aid,
                PROid: item.PROid,
                PROname: item.PROname,
                PROpicture: item.PROpicture
                    ? `${API_BASE}${item.PROpicture}`
                    : null,

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
   GET /me/orders/:Oid   (คำสั่งซื้อปกติ)
--------------------------------------------------*/
router.get("/me/orders/:id", async (req, res) => {
    try {
        const decoded = getUser(req);
        if (!decoded) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const userId = decoded.Cid;
        const { id } = req.params;

        /* ---------------------------
           1) โหลดข้อมูลคำสั่งซื้อหลัก
        ----------------------------*/
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

        /* ---------------------------
           2) โหลดสินค้าในคำสั่งซื้อ
        ----------------------------*/
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

        /* ---------------------------
           3) ส่งข้อมูลกลับ
        ----------------------------*/
        return res.json({
            Oid: order.Oid,
            price: order.Oprice,
            date: order.Odate,
            status: order.Ostatus,
            slip: order.Oslip,
            payment: order.Opayment,
            tracking: order.Otracking,
            shipping: order.Oshipping,
            items: items || []
        });

    } catch (err) {
        console.error("ORDER DETAIL ERROR:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
});









export default router;
