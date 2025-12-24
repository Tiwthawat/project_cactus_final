import { Request, Response, Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../app";
import { verifyToken } from "../middlewares/auth";
import { onlyAdmin } from "../middlewares/onlyAdmin";

const router = Router();
router.use(verifyToken, onlyAdmin);
/* -------------------------
   Types
--------------------------*/
interface AdminBidSummaryRow extends RowDataPacket {
    Aid: number;
    PROid: number;
    PROname: string;
    PROpicture: string | null;

    status: string;
    current_price: number;
    end_time: string;

    winner_id: number | null;
    winner_name: string | null;

    bid_count: number;
}

interface AdminBidRow extends RowDataPacket {
    Bidid: number;
    auction_id: number;
    user_id: number;
    username: string;
    amount: number;
    created_at: string;
}

/* ------------------------------------------
   GET /admin/bidding-logs?Aid=123
   -> สรุป+ประวัติการบิดของประมูล 1 รายการ
-------------------------------------------*/
router.get("/admin/bidding-logs", async (req: Request, res: Response) => {
    try {
        const Aid = Number(req.query.Aid);
        if (!Aid) {
            return res.status(400).json({ message: "กรุณาระบุ Aid ใน query" });
        }

        // summary
        const [summaryRows] = await pool.query<AdminBidSummaryRow[]>(
            `
      SELECT
        a.Aid,
        ap.PROid,
        ap.PROname,
        ap.PROpicture,
        a.status,
        a.current_price,
        a.end_time,
        a.winner_id,
        w.Cusername AS winner_name,
        COUNT(b.Bidid) AS bid_count
      FROM auctions a
      JOIN auction_products ap ON ap.PROid = a.PROid
      LEFT JOIN bids b ON b.auction_id = a.Aid
      LEFT JOIN customers w ON w.Cid = a.winner_id
      WHERE a.Aid = ?
      GROUP BY 
        a.Aid, ap.PROid, ap.PROname, ap.PROpicture,
        a.status, a.current_price, a.end_time,
        a.winner_id, w.Cusername
      `,
            [Aid]
        );

        if (summaryRows.length === 0) {
            return res.status(404).json({ message: "ไม่พบรอบประมูลนี้" });
        }

        const summary = summaryRows[0];

        // bid list
        const [bidRows] = await pool.query<AdminBidRow[]>(
            `
      SELECT
        b.Bidid,
        b.auction_id,
        b.user_id,
        c.Cusername AS username,
        b.amount,
        b.created_at
      FROM bids b
      JOIN customers c ON c.Cid = b.user_id
      WHERE b.auction_id = ?
      ORDER BY b.Bidid ASC
      `,
            [Aid]
        );

        return res.json({
            summary,
            bids: bidRows.map((b) => ({
                ...b,
                is_winner: summary.winner_id === b.user_id,
            })),
        });

    } catch (err) {
        console.error("ERROR /admin/bidding-logs:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});



export default router;
