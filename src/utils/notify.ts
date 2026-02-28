// src/lib/notify.ts

import { pool } from "../app";

export type NotificationType =
    | "order_created"
    | "order_cancelled"
    | "payment_uploaded"
    | "payment_approved"
    | "payment_rejected"
    | "order_shipped"
    | "order_delivered"
    | "review_reminder"
    | "auction_starting"
    | "auction_outbid"
    | "auction_ending"
    | "auction_won"
    | "auction_lost"
    | "auction_payment_due";

interface CreateNotificationArgs {
    customerId: number;
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
}

export async function createNotification({
    customerId,
    type,
    title,
    body = null,
    link = null,
}: CreateNotificationArgs) {
    await pool.query(
        `INSERT INTO notifications 
     (customer_id, type, title, body, link, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [customerId, type, title, body, link]
    );
}