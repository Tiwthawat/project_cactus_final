import { app } from "./app";
import { autoBanUnpaidWinners, autoCloseExpired } from "./routes/auctions";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);

	// รันตอน start 1 ครั้ง
	autoCloseExpired().catch(err => console.error("autoCloseExpired (startup) error:", err));
	autoBanUnpaidWinners().catch(err => console.error("autoBanUnpaidWinners (startup) error:", err));

	// รันทุก 5 นาที
	setInterval(async () => {
		try {
			await autoCloseExpired();       // ปิดรอบที่หมดเวลา
			await autoBanUnpaidWinners();   // แบนคนที่ไม่จ่ายใน 24 ชม.
		} catch (err) {
			console.error("❌ auction jobs error:", err);
		}
	}, 30 * 1000);

	// }, 5 * 60 * 1000);
});
