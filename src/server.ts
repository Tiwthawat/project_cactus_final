import { app } from "./app";
import { autoCloseExpired } from "./routes/auctions";

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
	autoCloseExpired().catch(err => console.error("autoClose (startup) error", err));

	// แล้วตั้งให้รันทุก ๆ 60 วินาที
	setInterval(async () => {
		try {
			await autoCloseExpired();
			// console.log("✅ autoCloseExpired tick");
		} catch (err) {
			console.error("❌ autoCloseExpired error:", err);
		}
	}, 60_000);
});
