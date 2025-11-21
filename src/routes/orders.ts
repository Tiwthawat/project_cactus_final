import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../app";

const router = Router();


interface Order extends RowDataPacket {
    Oid: number;
    Cid: number;
    Oprice: number;
    Odate: string;
    Ostatus: string;
    Oslip: string;
}
interface AdminOrder extends RowDataPacket {
    Oid: number;
    Oprice: number;
    Ostatus: string;
    Odate: string;
    Cname: string;
}

interface OrderItem extends RowDataPacket {
    Oiid: number;
    Oid: number;
    Pid: number;
    Oquantity: number;
    Oprice: number;
    Pname: string;
    Ppicture: string;
}
interface OrderSummary extends RowDataPacket {
    Oid: number;
    Odate: string;
    Ostatus: string;
    Ototal: number;
    products: string;
}
interface StatsResult extends RowDataPacket {
    totalOrders: number;
    totalSales: number;
    cancelledOrders: number;
    failedOrders: number;
    salesToday: number;
    salesThisWeek: number;
    salesThisMonth: number;
}

interface ReviewRow extends RowDataPacket {
    id: number;
    text: string;
    stars: number;
    created_at: string; // หรือ Date ก็ได้ ถ้า parse แล้ว
    order_id: number;
}

router.put('/orders/:id', async (req, res, next) => {
    const { id } = req.params;
    const { Ostatus } = req.body;

    if (!Ostatus) {
        return res.status(400).json({ message: "ต้องระบุ Ostatus" });
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1) ดึงข้อมูลคำสั่งซื้อก่อน (เช็กว่า COD ไหม)
        const [orders] = await conn.query<RowDataPacket[]>(
            `SELECT Opayment, Ostatus FROM orders WHERE Oid = ?`,
            [id]
        );
        const order = orders[0];

        // 2) ดึงรายการสินค้าในออเดอร์
        const [items] = await conn.query<RowDataPacket[]>(
            `SELECT Pid, Oquantity 
             FROM order_items 
             WHERE Oid = ?`,
            [id]
        );

        // ⭐ CASE 1: ชำระเงินสำเร็จ (paid) → ลดสต๊อกทันที
        if (Ostatus === 'paid') {
            for (const item of items) {
                await conn.query(
                    `UPDATE products
                     SET 
                       Pnumproduct = Pnumproduct - ?,
                       Prenume = COALESCE(Prenume,0) + ?
                     WHERE Pid = ?`,
                    [item.Oquantity, item.Oquantity, item.Pid]
                );
            }
        }

        // ⭐ CASE 2: shipped สำหรับ COD → ลดสต๊อกตอนส่งของ
        if (Ostatus === 'shipped' && order.Opayment === 'cod') {
            for (const item of items) {
                await conn.query(
                    `UPDATE products
                     SET 
                       Pnumproduct = Pnumproduct - ?,
                       Prenume = COALESCE(Prenume,0) + ?
                     WHERE Pid = ?`,
                    [item.Oquantity, item.Oquantity, item.Pid]
                );
            }
        }

        // ⭐ CASE 3 (optional): ถ้าอยากคืนสต๊อกเวลากดยกเลิก ให้บอกเค้าเพิ่ม

        // 3) อัปเดตสถานะคำสั่งซื้อ
        await conn.query(
            `UPDATE orders SET Ostatus = ? WHERE Oid = ?`,
            [Ostatus, id]
        );

        await conn.commit();
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });

    } catch (err) {
        await conn.rollback();
        console.error("❌ UPDATE Ostatus ERROR:", err);
        res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
    } finally {
        conn.release();
    }
});


router.get("/orders/all", async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        const [orders] = await connection.query<AdminOrder[]>(
            `SELECT o.Oid, o.Oprice, o.Ostatus, o.Odate, c.Cname
       FROM orders o
       JOIN customers c ON o.Cid = c.Cid
       ORDER BY o.Oid DESC`
        );

        res.status(200).json(orders);
    } catch (err) {
        console.error("❌ ADMIN GET ALL ORDERS ERROR:", err);
        res.status(500).json({ message: "ไม่สามารถโหลดคำสั่งซื้อได้" });
    } finally {
        connection.release();
    }
});


router.post("/orders", async (req, res, next) => {
    const { Cid, items, payment, totalPrice } = req.body;

    if (!Cid || !Array.isArray(items) || items.length === 0 || totalPrice === undefined) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [orderResult] = await connection.query<ResultSetHeader>(
            "INSERT INTO orders (Cid, Oprice, Odate, Ostatus, Opayment) VALUES (?, ?, NOW(), ?, ?)",
            [Cid, totalPrice, 'pending', payment]

        );

        const Oid = orderResult.insertId;

        for (const item of items) {
            await connection.query(
                "INSERT INTO order_items (Oid, Pid, Oquantity, Oprice) VALUES (?, ?, ?, ?)",
                [Oid, item.Pid, item.quantity, item.price]
            );
        }

        await connection.commit();
        res.status(201).json({ message: "สั่งซื้อสำเร็จ", orderId: Oid });

    } catch (error) {
        console.error("❌ ORDER ERROR:", error);
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
});


router.get("/orders", async (req, res, next) => {
    const { Cid } = req.query;

    if (!Cid) {
        return res.status(400).json({ message: "ต้องระบุ Cid" });
    }

    const connection = await pool.getConnection();
    try {
        interface Order extends RowDataPacket {
            Oid: number;
            Cid: number;
            Oprice: number;
            Odate: string;
            Ostatus: string;
        }

        const [orders] = await connection.query<Order[]>(
            "SELECT * FROM orders WHERE Cid = ? ORDER BY Odate DESC",
            [Cid]
        );

        const orderIds = orders.map((order) => order.Oid);

        if (orderIds.length === 0) {
            return res.json([]);
        }

        const [items] = await connection.query<OrderItem[]>(
            `SELECT oi.*, p.Pname, p.Ppicture 
             FROM order_items oi 
             JOIN products p ON oi.Pid = p.Pid 
             WHERE oi.Oid IN (?)`,
            [orderIds]
        );

        const orderMap = orders.map((order) => {
            return {
                ...order,
                items: items.filter((item) => item.Oid === order.Oid)
            };
        });

        res.json(orderMap);

    } catch (error) {
        next(error);
    } finally {
        connection.release();
    }
});

router.get("/orders/:id", async (req, res, next) => {
    const { id } = req.params;

    const connection = await pool.getConnection();
    try {
        const [orders] = await connection.query<Order[]>(
            `SELECT o.*, c.Cname
     FROM orders o
     JOIN customers c ON o.Cid = c.Cid
     WHERE o.Oid = ?`,
            [id]
        );

        const [items] = await connection.query<OrderItem[]>(
            `SELECT oi.*, p.Pname, p.Ppicture
            FROM order_items oi
            JOIN products p ON oi.Pid = p.Pid
            WHERE oi.Oid = ?`,
            [id]
        );

        res.json({ ...orders[0], items });

    } catch (error) {
        next(error);
    } finally {
        connection.release();
    }
});

router.patch("/orders/:id/slip", async (req, res, next) => {
    const { id } = req.params;
    const { slipUrl } = req.body;

    try {
        // 🔍 ดึงวิธีการชำระเงินก่อน
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT Opayment FROM orders WHERE Oid = ?`,
            [id]
        );
        const order = rows[0];

        if (order.Opayment === 'cod') {
            return res.status(400).json({ message: "คำสั่งซื้อแบบเก็บเงินปลายทาง ไม่ต้องแนบสลิป" });
        }

        // ✅ แนบสลิปตามปกติ
        await pool.query(`UPDATE orders SET Oslip = ?, Ostatus = 'waiting' WHERE Oid = ?`, [slipUrl, id]);
        res.json({ message: "บันทึกสลิปสำเร็จ" });
    } catch (err) {
        next(err);
    }
});


router.patch('/orders/:id/cancel', async (req, res, next) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE orders SET Ostatus = 'cancelled' WHERE Oid = ?`, [id]);
        res.json({ message: 'ยกเลิกคำสั่งซื้อแล้ว' });
    } catch (err) {
        next(err);
    }
});


router.get('/orders/customer/:id', async (req, res, next) => {
    try {
        const connection = await pool.getConnection()
        try {
            const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT o.Oid, o.Odate, o.Ostatus, o.Oprice, 
            GROUP_CONCAT(p.Pname SEPARATOR ', ') AS products
     FROM orders o
     LEFT JOIN order_items oi ON o.Oid = oi.Oid
     LEFT JOIN products p ON oi.Pid = p.Pid
     WHERE o.Cid = ?
     GROUP BY o.Oid
     ORDER BY o.Oid DESC`,
                [req.params.id]
            );


            res.json([...rows])
        } catch (error) {
            next(error)
        } finally {
            connection.release()
        }
    } catch (error) {
        next(error)
    }
})

// GET /orders/stats
router.get('/stats', async (req, res) => {
    try {
        const [rows] = await pool.query<StatsResult[]>(`
      SELECT 
        COUNT(*) AS totalOrders,
        SUM(Oprice) AS totalSales,
        SUM(CASE WHEN Ostatus = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
        SUM(CASE WHEN Ostatus = 'failed' THEN 1 ELSE 0 END) AS failedOrders,
        SUM(CASE WHEN DATE(Odate) = CURDATE() THEN Oprice ELSE 0 END) AS salesToday,
        SUM(CASE WHEN YEARWEEK(Odate, 1) = YEARWEEK(CURDATE(), 1) THEN Oprice ELSE 0 END) AS salesThisWeek,
        SUM(CASE WHEN MONTH(Odate) = MONTH(CURDATE()) AND YEAR(Odate) = YEAR(CURDATE()) THEN Oprice ELSE 0 END) AS salesThisMonth
      FROM orders
      
    `);
        console.log('📊 สถิติ:', rows);
        res.json(rows[0]);

    } catch (err) {
        console.error('Error loading stats:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดสถิติได้' });
    }
});

router.patch('/orders/:id/confirm', async (req, res, next) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.query<ResultSetHeader>(
                `UPDATE orders SET Ostatus = 'delivered' WHERE Oid = ? AND Ostatus = 'shipped'`,
                [req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(400).json({ message: 'ไม่สามารถยืนยันได้ (สถานะไม่ใช่ shipped)' });
            }

            res.json({ message: 'ยืนยันรับสินค้าเรียบร้อยแล้ว' });
        } catch (error) {
            next(error);
        } finally {
            connection.release();
        }
    } catch (error) {
        next(error);
    }
});

// GET /orders/:id/review
router.get('/orders/:id/review', async (req, res) => {
    const orderId = req.params.id;
    try {
        const [rows] = await pool.query<ReviewRow[]>(
            'SELECT * FROM reviews WHERE order_id = ?',
            [orderId]
        );
        res.json(rows[0] || null); // ส่ง null ถ้ายังไม่มี
    } catch (err) {
        console.error('Error fetching review:', err);
        res.status(500).json({ error: 'ไม่สามารถโหลดรีวิวได้' });
    }
});


router.post('/orders/:id/review', async (req, res) => {
    const { text, stars } = req.body;
    const orderId = req.params.id;

    try {
        // ❗ เช็กก่อนว่ามีอยู่แล้วหรือยัง
        const [existing] = await pool.query<ReviewRow[]>(
            'SELECT * FROM reviews WHERE order_id = ?',
            [orderId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'รีวิวนี้ถูกส่งไปแล้ว' });
        }

        // ✅ ยังไม่มี → สร้างรีวิวใหม่
        await pool.query(
            'INSERT INTO reviews (text, stars, order_id) VALUES (?, ?, ?)',
            [text, stars, orderId]
        );

        res.status(201).json({ message: 'Review created' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating review' });
    }
});

router.patch('/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const conn = await pool.getConnection();
        await conn.query('UPDATE orders SET Ostatus = ? WHERE Oid = ?', [status, id]);
        conn.release();
        res.json({ message: 'อัปเดตสถานะเรียบร้อย' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
    }
});



// GET /stats/full — รวมข้อมูลทั้งหมดของร้าน
router.get('/stats/full', async (req, res) => {
    try {
        // 1) ยอดขายเฉพาะ "ขายสำเร็จ"
        const [orderStats] = await pool.query<RowDataPacket[]>(`
            SELECT
                COUNT(*) AS totalOrders,

                -- รายได้จริง (bank/transfer ต้อง paid, cod ต้อง shipped/delivered)
                SUM(
                    CASE 
                        WHEN (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid')
                          OR (Opayment = 'cod' AND Ostatus IN ('shipped','delivered'))
                        THEN Oprice ELSE 0 END
                ) AS orderSales,

                -- จำนวนออเดอร์ยกเลิก
                SUM(CASE WHEN Ostatus = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,

                -- จำนวนออเดอร์ล้มเหลว
                SUM(CASE WHEN Ostatus = 'failed' THEN 1 ELSE 0 END) AS failedOrders,

                -- รายได้วันนี้ (เฉพาะขายสำเร็จ)
                SUM(
                    CASE 
                        WHEN DATE(Odate) = CURDATE()
                         AND (
                                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid') 
                                OR 
                                (Opayment = 'cod' AND Ostatus IN ('shipped','delivered'))
                             )
                        THEN Oprice ELSE 0 END
                ) AS orderToday,

                -- รายเดือน (เฉพาะขายสำเร็จ)
                SUM(
                    CASE 
                        WHEN MONTH(Odate) = MONTH(CURDATE())
                         AND YEAR(Odate) = YEAR(CURDATE())
                         AND (
                                (Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid') 
                                OR 
                                (Opayment = 'cod' AND Ostatus IN ('shipped','delivered'))
                             )
                        THEN Oprice ELSE 0 END
                ) AS orderMonth,

                -- รายได้จากการโอน/ชำระผ่านธนาคาร
                SUM(
                    CASE 
                        WHEN Opayment IN ('bank','transfer','bank_transfer') AND Ostatus = 'paid'
                        THEN Oprice ELSE 0 END
                ) AS bankSales,

                -- รายได้แบบเก็บเงินปลายทาง (ต้อง shipped/delivered เท่านั้น)
                SUM(
                    CASE 
                        WHEN Opayment = 'cod' AND Ostatus IN ('shipped','delivered')
                        THEN Oprice ELSE 0 END
                ) AS codSales

            FROM orders
        `);

        // 2) รายได้ประมูล
        const [auctionStats] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(*) AS totalAuctions,

                -- รายได้ประมูลเฉพาะจ่ายแล้ว
                SUM(
                    CASE WHEN ap.PROstatus = 'paid'
                        THEN a.current_price ELSE 0 END
                ) AS auctionSales,

                SUM(CASE WHEN ap.PROstatus = 'paid' THEN 1 ELSE 0 END) AS soldAuctionCount,
                SUM(CASE WHEN ap.PROstatus = 'unsold' THEN 1 ELSE 0 END) AS unsoldAuctionCount

            FROM auction_products ap
            JOIN auctions a ON a.PROid = ap.PROid
        `);

        // 3) รวมยอดทั้งหมด
        const totalSales =
            Number(orderStats[0].orderSales || 0) +
            Number(auctionStats[0].auctionSales || 0);

        res.json({
            ...orderStats[0],
            ...auctionStats[0],
            totalSales
        });

    } catch (err) {
        console.error("🔥 STATS ERROR:", err);
        res.status(500).json({ error: "ไม่สามารถโหลดสถิติได้" });
    }
});














export default router;
