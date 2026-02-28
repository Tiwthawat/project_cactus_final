// routes/auctions.ts
import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../app";
import { verifyToken, type AuthedRequest } from "../middlewares/auth";
import { uploadSlip } from "../middlewares/upload";

const upload = multer({ dest: "uploads/" });
const router = Router();

/* =========================================================
   Notifications (Auction)
   - No emoji
   - Do not remove old functions
   - Add notifications that should exist:
     1) Outbid
     2) Auction ending soon (requires calling exported job function)
     3) Auction won
     4) Auction lost
     5) Winner payment due reminder (12h / 23h)
     6) Overdue -> banned notice (when autoBanUnpaidWinners runs)
     7) (Optional) Starting soon: your schema has no start_time => skip safely
   ========================================================= */

type NotiType =
  | "auction_outbid"
  | "auction_ending_soon"
  | "auction_won"
  | "auction_lost"
  | "auction_payment_reminder"
  | "auction_payment_overdue_banned"
  | "auction_payment_uploaded";

/** Small helper: try insert notification, do not break main flow */
async function pushNotification(
  conn: PoolConnection,
  customerId: number,
  type: NotiType,
  title: string,
  body: string,
  link: string
) {
  if (!customerId) return;
  try {
    await conn.query(
      `INSERT INTO notifications
        (customer_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NOW())`,
      [customerId, type, title, body, link]
    );
  } catch {
    // ignore
  }
}

/**
 * Prevent duplicated notifications:
 * - If you have this table, it will work:
 *   auction_notification_logs (id, Aid, log_key, created_at)
 * - If not, it will silently skip de-dup (may repeat on cron).
 */
async function notiLogOnce(
  conn: PoolConnection,
  Aid: number,
  logKey: string
): Promise<boolean> {
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM auction_notification_logs WHERE Aid = ? AND log_key = ? LIMIT 1`,
      [Aid, logKey]
    );
    if (rows.length > 0) return false;

    await conn.query(
      `INSERT INTO auction_notification_logs (Aid, log_key, created_at)
       VALUES (?, ?, NOW())`,
      [Aid, logKey]
    );
    return true;
  } catch {
    // If table doesn't exist, allow sending (best effort)
    return true;
  }
}

/** Format price for Thai display */
function fmtBaht(n: number) {
  return Number(n || 0).toLocaleString("th-TH");
}

/** Build auction link (adjust to your frontend route) */
function auctionLink(Aid: number) {
  return `/auctions/${Aid}`;
}

/** ====== rows / types ====== */

/** Row from auctions table */
interface AuctionsTableRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  winner_id: number | null;
  PROdetail: string | null;
}

interface AuctionRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
}

/** Row for listing products */
interface AuctionProductListRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROpicture: string; // can be multiple urls separated by comma
  PROprice: number;
  PROstatus: string;
  active_aid: number | null;
  active_end_time: Date | null;
  active_current_price: number | null;
  PROdetail: string | null;
}

/** Row for auction list (joined) */
interface AuctionListRow extends RowDataPacket {
  Aid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
  PROid: number;
  PROname: string;
  PROpicture: string;
  PROdetail: string | null;
  winnerName: string | null;
}

/** Row for product */
interface AuctionProductRow extends RowDataPacket {
  PROid: number;
  PROname: string;
  PROprice: number;
  PROstatus: string;
  PROpicture: string;
  PROdetail: string | null;
  PROrenume?: string | null;
  active_aid?: number | null;
  active_end_time?: Date | null;
  active_current_price?: number | null;
}

type AuctionStatus = "open" | "closed" | "all";

/** Detail row */
interface AuctionDetailRow extends RowDataPacket {
  Aid: number;
  start_price: number;
  current_price: number;
  end_time: Date;
  status: "open" | "closed";
  min_increment: number;
  PROid: number;
  PROname: string;
  PROpicture: string;
  PROdetail: string | null;
  PROstatus: string;
  PROprice: number;
  winner_id: number | null;
  winnerName: string | null;
}

/** Bid row */
interface BidRow extends RowDataPacket {
  Bidid: number;
  auction_id: number;
  user_id: number;
  amount: number;
  created_at: Date;
}

/** Leader row */
interface AuctionLeader extends RowDataPacket {
  user_id: number | null;
  username: string | null;
  amount: number | null;
  created_at: Date | null;
}

interface AuctionWinnerRow extends RowDataPacket {
  winner_id: number | null;
  current_price: number;
  PROid: number;
}

interface AuctionCheckoutRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  winner_id: number | null;
  current_price: number;
  PROstatus: string;
}

interface AuctionToShipRow extends RowDataPacket {
  Aid: number;
  PROid: number;
  PROname: string;
  current_price: number;
  winner_name: string;
  end_time: Date;
  payment_status: string | null;
  shipping_status: string | null;
  tracking_number: string | null;
  shipping_company: string | null;
}

/* =========================================================
   Background helpers (you must call these from app scheduler)
   - call every 1 minute:
     - autoCloseExpired()
     - autoNotifyAuctionEndingSoon()
     - autoRemindAuctionWinnerPayment()
     - autoBanUnpaidWinners()  (you already have)
   ========================================================= */

/**
 * Auction ending soon
 * - This requires cron/interval call
 * - Sends to distinct bidders (best signal) only
 * - Default window: 10 minutes before end
 */
export async function autoNotifyAuctionEndingSoon(windowMinutes = 10) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [soon] = await conn.query<RowDataPacket[]>(
      `
      SELECT a.Aid, a.end_time
      FROM auctions a
      WHERE a.status='open'
        AND a.end_time > NOW()
        AND a.end_time <= DATE_ADD(NOW(), INTERVAL ? MINUTE)
      FOR UPDATE
      `,
      [windowMinutes]
    );

    for (const a of soon) {
      const Aid = Number(a.Aid);
      if (!Aid) continue;

      // de-dup per window key
      const ok = await notiLogOnce(conn, Aid, `ending_soon_${windowMinutes}m`);
      if (!ok) continue;

      // find bidders
      const [bidders] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT user_id FROM bids WHERE auction_id = ?`,
        [Aid]
      );

      for (const b of bidders) {
        const Cid = Number(b.user_id);
        if (!Cid) continue;

        await pushNotification(
          conn,
          Cid,
          "auction_ending_soon",
          "ใกล้ปิดประมูล",
          `ประมูล #${Aid} ใกล้หมดเวลาแล้ว รีบตัดสินใจก่อนปิด`,
          auctionLink(Aid)
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Winner payment reminders
 * - Based on auctions.end_time (winner must pay within 24h)
 * - Sends at 12h and 23h (customizable)
 * - Only for payment_status = 'pending_payment'
 */
export async function autoRemindAuctionWinnerPayment() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 12h reminder
    const [rows12] = await conn.query<RowDataPacket[]>(
      `
      SELECT Aid, winner_id, end_time, current_price
      FROM auctions
      WHERE status='closed'
        AND winner_id IS NOT NULL
        AND payment_status='pending_payment'
        AND end_time <= DATE_SUB(NOW(), INTERVAL 12 HOUR)
        AND end_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      FOR UPDATE
      `
    );

    for (const r of rows12) {
      const Aid = Number(r.Aid);
      const winnerId = Number(r.winner_id);
      if (!Aid || !winnerId) continue;

      const ok = await notiLogOnce(conn, Aid, "payment_reminder_12h");
      if (!ok) continue;

      await pushNotification(
        conn,
        winnerId,
        "auction_payment_reminder",
        "แจ้งเตือนการชำระเงิน",
        `คุณชนะประมูล #${Aid} กรุณาชำระภายใน 24 ชั่วโมง (ยอด ${fmtBaht(
          Number(r.current_price || 0)
        )} บาท)`,
        `/me/auction-wins/${Aid}`
      );
    }

    // 23h reminder
    const [rows23] = await conn.query<RowDataPacket[]>(
      `
      SELECT Aid, winner_id, end_time, current_price
      FROM auctions
      WHERE status='closed'
        AND winner_id IS NOT NULL
        AND payment_status='pending_payment'
        AND end_time <= DATE_SUB(NOW(), INTERVAL 23 HOUR)
        AND end_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      FOR UPDATE
      `
    );

    for (const r of rows23) {
      const Aid = Number(r.Aid);
      const winnerId = Number(r.winner_id);
      if (!Aid || !winnerId) continue;

      const ok = await notiLogOnce(conn, Aid, "payment_reminder_23h");
      if (!ok) continue;

      await pushNotification(
        conn,
        winnerId,
        "auction_payment_reminder",
        "ใกล้ครบกำหนดชำระ",
        `เหลือเวลาอีกไม่นานก่อนครบกำหนด 24 ชั่วโมง สำหรับประมูล #${Aid} (ยอด ${fmtBaht(
          Number(r.current_price || 0)
        )} บาท)`,
        `/me/auction-wins/${Aid}`
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================================================
   0) autoCloseExpired (ADD notifications: won / lost)
   ========================================================= */

export async function autoCloseExpired() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) find expired open auctions
    const [expired] = await conn.query<AuctionRow[]>(
      `SELECT a.Aid, a.PROid, a.start_price, a.current_price, a.end_time
       FROM auctions a
       WHERE a.status='open'
         AND a.end_time <= NOW()
       FOR UPDATE`
    );

    for (const auc of expired) {
      // 2) find highest bid
      const [bids] = await conn.query<BidRow[]>(
        `SELECT user_id, amount
         FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC, created_at ASC
         LIMIT 1`,
        [auc.Aid]
      );

      if (bids.length === 0) {
        // no winner
        await conn.query<ResultSetHeader>(
          `UPDATE auctions
           SET status='closed',
               winner_id=NULL,
               current_price=start_price,
               payment_status=NULL
           WHERE Aid=?`,
          [auc.Aid]
        );

        await conn.query<ResultSetHeader>(
          `UPDATE auction_products SET PROstatus='unsold' WHERE PROid=?`,
          [auc.PROid]
        );
      } else {
        const winnerId = Number(bids[0].user_id);
        const winAmount = Number(bids[0].amount);

        await conn.query<ResultSetHeader>(
          `UPDATE auctions
           SET status='closed',
               winner_id=?,
               current_price=?,
               payment_status='pending_payment'
           WHERE Aid=?`,
          [winnerId, winAmount, auc.Aid]
        );

        await conn.query<ResultSetHeader>(
          `UPDATE auction_products SET PROstatus='pending_payment' WHERE PROid=?`,
          [auc.PROid]
        );

        // Notifications: won / lost (send once)
        const wonOk = await notiLogOnce(conn, auc.Aid, "auction_closed_wonlost");
        if (wonOk) {
          // Winner
          await pushNotification(
            conn,
            winnerId,
            "auction_won",
            "คุณชนะประมูล",
            `คุณชนะประมูล #${auc.Aid} ยอดชนะ ${fmtBaht(winAmount)} บาท กรุณาชำระภายใน 24 ชั่วโมง`,
            `/me/auction-wins/${auc.Aid}`
          );

          // Losers: distinct bidders excluding winner
          const [losers] = await conn.query<RowDataPacket[]>(
            `SELECT DISTINCT user_id
             FROM bids
             WHERE auction_id = ?
               AND user_id <> ?`,
            [auc.Aid, winnerId]
          );

          for (const l of losers) {
            const loserId = Number(l.user_id);
            if (!loserId) continue;

            await pushNotification(
              conn,
              loserId,
              "auction_lost",
              "ประมูลจบแล้ว",
              `ประมูล #${auc.Aid} จบแล้ว คุณไม่ได้เป็นผู้ชนะ รอบหน้าลองสู้ใหม่ได้`,
              auctionLink(auc.Aid)
            );
          }
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* =========================
   1) List auctions
   ========================= */
router.get("/auctions", async (req, res, next) => {
  try {
    await autoCloseExpired();

    const rawStatus = (req.query.status as string) ?? "all";
    const statusFilter: "open" | "closed" | "all" =
      ["open", "closed", "all"].includes(rawStatus) ? (rawStatus as any) : "all";

    const resultFilter = (req.query.result as string) ?? "";
    const payFilter = (req.query.payment_status as string) ?? "";
    const shipFilter = (req.query.shipping_status as string) ?? "";

    let sql = `
      SELECT 
        a.Aid,
        a.start_price,
        a.current_price,
        a.end_time,
        a.status,
        a.payment_status,
        p.PROid,
        p.PROname,
        p.PROpicture,
        p.shipping_status,
        c.Cusername AS winnerName
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      LEFT JOIN customers c ON a.winner_id = c.Cid
    `;

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (statusFilter !== "all") {
      where.push("a.status = ?");
      params.push(statusFilter);
    }

    if (resultFilter === "won") {
      where.push("a.winner_id IS NOT NULL");
    } else if (resultFilter === "unsold") {
      where.push("a.winner_id IS NULL");
    }

    if (payFilter) {
      where.push("a.payment_status = ?");
      params.push(payFilter);
    }
    if (shipFilter) {
      where.push("p.shipping_status = ?");
      params.push(shipFilter);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += " ORDER BY a.end_time DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ===========================================
   2) Admin add auction product
   =========================================== */
router.post(
  "/auction-products",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { PROname, PROprice, PROpicture, PROdetail } = req.body;

      if (!PROname || String(PROname).trim() === "") {
        return res.status(400).json({ error: "ต้องกรอกชื่อสินค้า" });
      }

      const priceNum = Number(PROprice ?? 0);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "ราคาไม่ถูกต้อง" });
      }

      const pictureUrl = PROpicture ?? "";

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO auction_products (PROname, PROprice, PROstatus, PROpicture, PROdetail)
         VALUES (?, ?, 'ready', ?, ?)`,
        [PROname, priceNum, pictureUrl, PROdetail ?? null]
      );

      res.status(201).json({
        message: "เพิ่มสินค้าเข้าสู่การประมูลสำเร็จ",
        PROid: result.insertId,
        PROpicture: pictureUrl,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================
   3) Admin open new auction
   ========================== */
router.post(
  "/auctions",
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { PROid, start_price, end_time, min_increment } = req.body;

      const proIdNum = Number(PROid);
      const startNum = Number(start_price);
      const minIncNum =
        Number.isInteger(Number(min_increment)) && Number(min_increment) > 0
          ? Number(min_increment)
          : 1;

      if (!proIdNum || Number.isNaN(proIdNum)) {
        return res.status(400).json({ error: "PROid ไม่ถูกต้อง" });
      }
      if (Number.isNaN(startNum) || startNum <= 0) {
        return res.status(400).json({ error: "start_price ต้อง > 0" });
      }
      if (!end_time) {
        return res.status(400).json({ error: "กรุณาระบุ end_time" });
      }
      const end = new Date(end_time);
      if (isNaN(end.getTime()) || end <= new Date()) {
        return res.status(400).json({ error: "end_time ต้องเป็นเวลาอนาคต" });
      }

      await conn.beginTransaction();

      const [proRows] = await conn.query<AuctionProductRow[]>(
        `SELECT PROid FROM auction_products WHERE PROid = ? FOR UPDATE`,
        [proIdNum]
      );
      if (proRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบสินค้า" });
      }

      await conn.query<ResultSetHeader>(
        `UPDATE auctions SET status='closed' WHERE status='open' AND end_time <= NOW()`
      );

      const [openRows] = await conn.query<AuctionRow[]>(
        `SELECT Aid FROM auctions WHERE PROid=? AND status='open' LIMIT 1 FOR UPDATE`,
        [proIdNum]
      );
      if (openRows.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: "มีรอบที่เปิดอยู่แล้ว" });
      }

      const [ins] = await conn.query<ResultSetHeader>(
        `INSERT INTO auctions (PROid, start_price, current_price, end_time, status, min_increment)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [proIdNum, startNum, startNum, end, minIncNum]
      );

      await conn.query(
        `UPDATE auction_products SET PROstatus='auction' WHERE PROid=?`,
        [proIdNum]
      );

      // NOTE: "Auction starting soon" needs start_time (not in schema). Skip safely.

      await conn.commit();
      res.status(201).json({
        ok: true,
        Aid: ins.insertId,
        PROid: proIdNum,
        start_price: startNum,
        current_price: startNum,
        end_time: end.toISOString(),
        status: "open",
        min_increment: minIncNum,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

/* ======================
   4) User bid (ADD: Outbid)
   ====================== */
router.post(
  "/auctions/:id/bid",
  verifyToken,
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const Aid = Number(req.params.id);
      const amount = Number(req.body.amount);
      const u = req.user;

      if (!u || u.role !== "user") {
        conn.release();
        return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });
      }

      const Cid = u.Cid;

      if (!Aid || Number.isNaN(Aid)) {
        return res.status(400).json({ error: "Auction ID ไม่ถูกต้อง" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "จำนวนเงินไม่ถูกต้อง" });
      }

      await conn.beginTransaction();

      const [rows] = await conn.query<AuctionRow[]>(
        `SELECT current_price, status, end_time, min_increment
         FROM auctions
         WHERE Aid = ?
         FOR UPDATE`,
        [Aid]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "ไม่พบรอบประมูล" });
      }

      const { current_price, status, end_time, min_increment } = rows[0];

      if (status !== "open" || new Date(end_time) <= new Date()) {
        await conn.rollback();
        return res.status(400).json({ error: "AUCTION_CLOSED" });
      }

      const requiredMin =
        Number(current_price) + Math.max(1, Number(min_increment ?? 1));
      if (amount < requiredMin) {
        await conn.rollback();
        return res.status(400).json({ error: "BID_TOO_LOW", requiredMin });
      }

      // Find previous leader (before inserting new bid)
      const [prevLeaderRows] = await conn.query<RowDataPacket[]>(
        `SELECT user_id, amount
         FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC, created_at ASC
         LIMIT 1`,
        [Aid]
      );

      const prevLeaderId = prevLeaderRows.length
        ? Number(prevLeaderRows[0].user_id)
        : null;

      await conn.query(
        `INSERT INTO bids (auction_id, user_id, amount)
         VALUES (?, ?, ?)`,
        [Aid, Cid, amount]
      );

      await conn.query<ResultSetHeader>(
        `UPDATE auctions
         SET current_price = ?
         WHERE Aid = ?`,
        [amount, Aid]
      );

      // Outbid notification to previous leader (not self)
      if (prevLeaderId && prevLeaderId !== Cid) {
        const ok = await notiLogOnce(conn, Aid, `outbid_${prevLeaderId}_${amount}`);
        if (ok) {
          await pushNotification(
            conn,
            prevLeaderId,
            "auction_outbid",
            "มีคนแซงบิดแล้ว",
            `ประมูล #${Aid} มีราคาสูงกว่าแล้ว ตอนนี้อยู่ที่ ${fmtBaht(amount)} บาท`,
            auctionLink(Aid)
          );
        }
      }

      await conn.commit();
      return res.json({ ok: true, Aid, new_price: amount });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

/* ======================
   5) Close auction (ADD: won/lost)
   ====================== */
router.patch("/auctions/:id/close", async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const Aid = Number(id);
    if (!Aid) return res.status(400).json({ error: "Aid ไม่ถูกต้อง" });

    await conn.beginTransaction();

    const [aucRows] = await conn.query<RowDataPacket[]>(
      `SELECT Aid, PROid, start_price, status
       FROM auctions
       WHERE Aid = ?
       FOR UPDATE`,
      [Aid]
    );

    if (aucRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "ไม่พบรอบประมูล" });
    }

    const PROid = Number(aucRows[0].PROid);

    const [bids] = await conn.query<BidRow[]>(
      `SELECT user_id, amount
       FROM bids
       WHERE auction_id = ?
       ORDER BY amount DESC, created_at ASC
       LIMIT 1`,
      [Aid]
    );

    if (bids.length === 0) {
      await conn.query<ResultSetHeader>(
        `UPDATE auctions
         SET status='closed',
             winner_id=NULL,
             current_price=start_price,
             payment_status=NULL
         WHERE Aid=?`,
        [Aid]
      );

      await conn.query<ResultSetHeader>(
        `UPDATE auction_products
         SET PROstatus='ready'
         WHERE PROid=?`,
        [PROid]
      );

      await conn.commit();
      return res.json({ message: "ปิดประมูลแล้ว (ไม่มีผู้ชนะ)" });
    }

    const winnerId = Number(bids[0].user_id);
    const winAmount = Number(bids[0].amount);

    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE auctions
       SET status='closed',
           winner_id=?,
           current_price=?,
           payment_status='pending_payment'
       WHERE Aid=?`,
      [winnerId, winAmount, Aid]
    );

    await conn.query<ResultSetHeader>(
      `UPDATE auction_products
       SET PROstatus='pending_payment'
       WHERE PROid=?`,
      [PROid]
    );

    // Notifications: won / lost
    const ok = await notiLogOnce(conn, Aid, "auction_closed_wonlost");
    if (ok) {
      await pushNotification(
        conn,
        winnerId,
        "auction_won",
        "คุณชนะประมูล",
        `คุณชนะประมูล #${Aid} ยอดชนะ ${fmtBaht(winAmount)} บาท กรุณาชำระภายใน 24 ชั่วโมง`,
        `/me/auction-wins/${Aid}`
      );

      const [losers] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT user_id
         FROM bids
         WHERE auction_id = ?
           AND user_id <> ?`,
        [Aid, winnerId]
      );

      for (const l of losers) {
        const loserId = Number(l.user_id);
        if (!loserId) continue;

        await pushNotification(
          conn,
          loserId,
          "auction_lost",
          "ประมูลจบแล้ว",
          `ประมูล #${Aid} จบแล้ว คุณไม่ได้เป็นผู้ชนะ รอบหน้าลองสู้ใหม่ได้`,
          auctionLink(Aid)
        );
      }
    }

    await conn.commit();

    if (result.affectedRows === 0) {
      return res.status(409).json({ error: "ปิดประมูลไม่สำเร็จ" });
    }

    return res.json({ message: "ปิดประมูลแล้ว", winnerId, winAmount });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* ===========================
   6) Auction detail
   =========================== */
router.get("/auction/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await autoCloseExpired();

    const [rows] = await pool.query<AuctionDetailRow[]>(
      `
      SELECT 
        a.Aid, 
        a.start_price, 
        a.current_price,
        a.current_price AS close_price,
        a.end_time, 
        a.status,
        a.min_increment, 
        a.winner_id,
        a.payment_status,

        p.PROid, 
        p.PROname, 
        p.PROpicture, 
        p.PROdetail, 
        p.PROstatus, 
        p.PROprice,
        p.shipping_company,
        p.tracking_number,
        p.shipping_status,

        c.Cusername AS winnerName
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      LEFT JOIN customers c ON a.winner_id = c.Cid
      WHERE a.Aid = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "ไม่พบรายการประมูล" });
    }

    const auc = rows[0];

    res.json({
      ...auc,
      winnerName: auc.winnerName ?? "",
    });
  } catch (err) {
    console.error("GET /auction/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ===========================
   Auction products list
   =========================== */
router.get("/auction-products", async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) ?? "all";
    const q = (req.query.q as string | undefined)?.trim();

    const available =
      Object.prototype.hasOwnProperty.call(req.query, "available") &&
      String(req.query.available).toLowerCase() !== "0" &&
      String(req.query.available).toLowerCase() !== "false";

    let sql = `
      SELECT 
        p.PROid, 
        p.PROname, 
        p.PROpicture, 
        p.PROprice, 
        p.PROstatus, 
        p.PROdetail,

        a.Aid AS active_aid,
        a.end_time AS active_end_time,
        a.current_price AS active_current_price
      FROM auction_products p
      LEFT JOIN auctions a 
        ON a.Aid = (
          SELECT Aid 
          FROM auctions 
          WHERE PROid = p.PROid
          ORDER BY end_time DESC
          LIMIT 1
        )
    `;

    const params: Array<string | number> = [];
    const where: string[] = [];

    if (status !== "all") {
      where.push("p.PROstatus = ?");
      params.push(status);
    }

    if (q) {
      where.push("(p.PROname LIKE ?)");
      params.push(`%${q}%`);
    }

    if (available) {
      where.push(`
        NOT EXISTS (
          SELECT 1 FROM auctions ax
          WHERE ax.PROid = p.PROid AND ax.status = 'open'
        )
      `);
    }

    if (where.length) sql += ` WHERE ${where.join(" AND ")}`;

    sql += ` ORDER BY p.PROid DESC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Delete auction product
   =========================== */
router.delete("/auction-products/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM auction_products WHERE PROid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบสินค้าที่ต้องการลบ" });
    }

    res.json({ message: "ลบสินค้าออกจากการประมูลสำเร็จ" });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Delete auction round
   =========================== */
router.delete("/auctions/:id", async (req: Request, res: Response, next: NextFunction) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [rows] = await conn.query<AuctionsTableRow[]>(
      `SELECT Aid, PROid, start_price, current_price, status
       FROM auctions
       WHERE Aid = ?
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "ไม่พบรอบประมูล" });
    }

    const a = rows[0];

    if (a.current_price > a.start_price) {
      await conn.rollback();
      return res.status(400).json({ error: "ลบไม่ได้: รอบนี้มีคนบิดแล้ว" });
    }

    if (a.status !== "open") {
      await conn.rollback();
      return res.status(400).json({ error: "ลบได้เฉพาะรอบที่ยังเปิดอยู่" });
    }

    const [result] = await conn.query<ResultSetHeader>(
      `DELETE FROM auctions WHERE Aid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json({ error: "ลบไม่สำเร็จ" });
    }

    await conn.query(
      `UPDATE auction_products
       SET PROstatus = 'ready'
       WHERE PROid = ?`,
      [a.PROid]
    );

    await conn.commit();
    res.json({ message: "ลบรอบสำเร็จ และคืนสถานะสินค้าแล้ว" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* ===========================
   Get one product + active auction
   =========================== */
router.get("/auction-products/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id ไม่ถูกต้อง" });

    const sql = `
      SELECT 
        p.PROid, p.PROname, p.PROprice, p.PROstatus, p.PROpicture,
        p.PROdetail, p.PROrenume,
        a.Aid AS active_aid, a.end_time AS active_end_time, a.current_price AS active_current_price
      FROM auction_products p
      LEFT JOIN auctions a
        ON a.PROid = p.PROid AND a.status = 'open'
      WHERE p.PROid = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<AuctionProductRow[]>(sql, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบสินค้า" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Leader
   =========================== */
router.get("/auction/:id/leader", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<AuctionLeader[]>(
      `
      SELECT 
        b.user_id, 
        c.Cusername AS username, 
        b.amount, 
        b.created_at
      FROM bids b
      JOIN customers c ON b.user_id = c.Cid
      WHERE b.auction_id = ?
      ORDER BY b.amount DESC, b.created_at DESC
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.json({ leader: null });
    }

    res.json({
      leader: {
        user_id: rows[0].user_id,
        username: rows[0].username,
        amount: rows[0].amount,
        created_at: rows[0].created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Legacy pay (kept)
   =========================== */
router.post("/auction/:id/pay", upload.single("slip"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const Aid = Number(req.params.id);
    const userId = Number(req.body.user_id);
    const file = req.file;

    if (!Aid || !userId || !file) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบ" });
    }

    const [rows] = await pool.query<AuctionWinnerRow[]>(
      `
      SELECT winner_id, current_price, PROid
      FROM auctions
      WHERE Aid=?
      LIMIT 1
      `,
      [Aid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "ไม่พบรอบประมูลนี้" });
    }

    const auc = rows[0];

    if (auc.winner_id !== userId) {
      return res.status(403).json({ error: "คุณไม่ใช่ผู้ชนะของรอบนี้" });
    }

    const slipPath = "/uploads/" + file.filename;

    await pool.query(
      `
      INSERT INTO auction_payments (Aid, PROid, winner_id, amount, slip)
      VALUES (?, ?, ?, ?, ?)
      `,
      [Aid, auc.PROid, userId, auc.current_price, slipPath]
    );

    await pool.query(
      `
      UPDATE auction_products
      SET PROstatus='paid'
      WHERE PROid=?
      `,
      [auc.PROid]
    );

    // Notify winner that slip uploaded (optional but useful)
    try {
      const conn = await pool.getConnection();
      try {
        await pushNotification(
          conn,
          userId,
          "auction_payment_uploaded",
          "ส่งสลิปสำเร็จ",
          `ส่งสลิปสำหรับประมูล #${Aid} แล้ว รอแอดมินตรวจสอบ`,
          `/me/auction-wins/${Aid}`
        );
      } finally {
        conn.release();
      }
    } catch { }

    return res.json({
      ok: true,
      slip: slipPath,
    });
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Checkout (ADD: payment_uploaded noti)
   =========================== */
router.post(
  "/auction-checkout",
  verifyToken,
  uploadSlip.single("slip"),
  async (req: AuthedRequest, res: Response) => {
    const conn = await pool.getConnection();
    try {
      const { Aid } = req.body;
      const u = req.user;
      if (!u || u.role !== "user") {
        conn.release();
        return res.status(403).json({ message: "เฉพาะลูกค้าเท่านั้น" });
      }
      const Cid = u.Cid;

      const slip = req.file;

      if (!Aid) {
        conn.release();
        return res.status(400).json({ message: "ไม่มี Aid ในคำขอ" });
      }

      if (!slip) {
        conn.release();
        return res.status(400).json({ message: "กรุณาอัปโหลดสลิป" });
      }

      const [rows] = await conn.query<AuctionCheckoutRow[]>(
        `
        SELECT a.Aid, a.PROid, a.winner_id, a.current_price, p.PROstatus
        FROM auctions a
        JOIN auction_products p ON a.PROid = p.PROid
        WHERE a.Aid = ?
        `,
        [Aid]
      );

      if (rows.length === 0) {
        conn.release();
        return res.status(404).json({ message: "ไม่พบรายการประมูลนี้" });
      }

      const auc = rows[0];

      if (auc.winner_id !== Cid) {
        conn.release();
        return res.status(403).json({ message: "ไม่ได้เป็นผู้ชนะรายการนี้" });
      }

      if (auc.PROstatus !== "pending_payment") {
        conn.release();
        return res.status(400).json({ message: "รายการนี้ชำระเงินแล้ว หรือสถานะไม่ถูกต้อง" });
      }

      await conn.query(
        `
        INSERT INTO auction_payments 
        (Aid, PROid, winner_id, amount, slip, paid_at, status)
        VALUES (?, ?, ?, ?, ?, NOW(), 'payment_review')
        `,
        [Aid, auc.PROid, Cid, auc.current_price, "/slips/" + slip.filename]
      );

      await conn.query(
        `
        UPDATE auction_products 
        SET PROstatus = 'payment_review'
        WHERE PROid = ?
        `,
        [auc.PROid]
      );

      await conn.query(
        `
        UPDATE auctions
        SET payment_status = 'payment_review'
        WHERE Aid = ?
        `,
        [Aid]
      );

      // Notify winner: uploaded slip success
      await pushNotification(
        conn,
        Cid,
        "auction_payment_uploaded",
        "ส่งสลิปสำเร็จ",
        `ส่งสลิปสำหรับประมูล #${Aid} แล้ว รอแอดมินตรวจสอบ`,
        `/me/auction-wins/${Aid}`
      );

      conn.release();
      return res.json({ message: "อัปโหลดสลิปสำเร็จ รอแอดมินตรวจสอบ" });
    } catch (err: any) {
      conn.release();
      console.error("/auction-checkout error:", err);
      return res.status(500).json({
        message: "เกิดข้อผิดพลาด",
        detail: err?.message,
      });
    }
  }
);

/* ===========================
   Admin winners list
   =========================== */
router.get("/auctions/winners", verifyToken, async (req: AuthedRequest, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "admin only" });
    }

    await autoCloseExpired();

    const type = String(req.query.type || "pending_payment");
    const limit = Math.min(Number(req.query.limit || 10), 50);

    const where: string[] = [];
    const params: any[] = [];

    if (type === "pending_payment") {
      where.push("a.payment_status = 'pending_payment'");
    } else if (type === "payment_review") {
      where.push("a.payment_status = 'payment_review'");
    }

    const sql = `
      SELECT
        a.Aid AS Aid,  
        p.PROid,
        p.PROname,
        a.current_price,
        c.Cusername AS winner_name,
        a.end_time,
        p.PROstatus
      FROM auctions a
      JOIN auction_products p ON a.PROid = p.PROid
      LEFT JOIN customers c ON a.winner_id = c.Cid
      WHERE a.status = 'closed'
        AND a.winner_id IS NOT NULL
        ${where.length ? "AND " + where.join(" AND ") : ""}
      ORDER BY a.end_time DESC
      LIMIT ?
    `;

    params.push(limit);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* ===========================
   Admin shipping list
   =========================== */
router.get("/auctions/shipping", async (req, res, next) => {
  try {
    await autoCloseExpired();

    const year = Number(req.query.year) || new Date().getFullYear();
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const [rows] = await pool.query<AuctionToShipRow[]>(
      `
      SELECT
        a.Aid,
        p.PROid,
        p.PROname,
        a.current_price,
        c.Cusername AS winner_name,
        a.end_time,
        a.payment_status,
        p.shipping_status,
        p.tracking_number,
        p.shipping_company
      FROM auctions a
      JOIN auction_products p ON p.PROid = a.PROid
      JOIN customers c ON c.Cid = a.winner_id
      WHERE a.status = 'closed'
        AND a.winner_id IS NOT NULL
        AND a.payment_status = 'paid'
        AND YEAR(a.end_time) = ?
        AND (p.shipping_status IS NULL OR p.shipping_status IN ('to_ship','pending','ready'))
      ORDER BY a.end_time DESC
      LIMIT ?
      `,
      [year, limit]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   Auto ban unpaid winners (ADD: banned notification)
   - your original logic is kept
   - add: notify banned users once per auction
   ========================================================= */
export async function autoBanUnpaidWinners() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Find overdue auctions first (so we can notify)
    const [overdue] = await conn.query<RowDataPacket[]>(
      `
      SELECT Aid, winner_id, current_price
      FROM auctions
      WHERE status = 'closed'
        AND winner_id IS NOT NULL
        AND end_time IS NOT NULL
        AND payment_status = 'pending_payment'
        AND end_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
      FOR UPDATE
      `
    );

    // 1) ban customers
    await conn.query(`
      UPDATE customers c
      JOIN auctions a ON a.winner_id = c.Cid
      SET c.Cstatus = 'banned'
      WHERE a.status = 'closed'
        AND a.winner_id IS NOT NULL
        AND a.end_time IS NOT NULL
        AND a.payment_status = 'pending_payment'
        AND a.end_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
        AND (c.Cstatus IS NULL OR c.Cstatus <> 'banned')
    `);

    // 2) set auction expired
    await conn.query(`
      UPDATE auctions
      SET payment_status = 'expired'
      WHERE status = 'closed'
        AND winner_id IS NOT NULL
        AND end_time IS NOT NULL
        AND payment_status = 'pending_payment'
        AND end_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);

    // 3) notify banned (best effort)
    for (const r of overdue) {
      const Aid = Number(r.Aid);
      const winnerId = Number(r.winner_id);
      if (!Aid || !winnerId) continue;

      const ok = await notiLogOnce(conn, Aid, "payment_overdue_banned");
      if (!ok) continue;

      await pushNotification(
        conn,
        winnerId,
        "auction_payment_overdue_banned",
        "ถูกระงับบัญชีชั่วคราว",
        `คุณไม่ชำระเงินสำหรับประมูล #${Aid} ภายใน 24 ชั่วโมง ระบบระงับบัญชีตามเงื่อนไข`,
        `/me/auction-wins/${Aid}`
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default router;