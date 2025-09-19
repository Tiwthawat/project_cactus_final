import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createPool } from "mysql2/promise";
import path from "path";
import ServerlessHttp from "serverless-http";
import errorHandler from "./middlewares/errors";
import adminReview from './routes/admin_reviews';
import changePassword from './routes/change-password';
import customerall from "./routes/customer_all";
import favorites from './routes/favoritesRoutes';
import login from "./routes/login";
import me from "./routes/me";
import orders from './routes/orders';
import payment from './routes/payment';
import productID from "./routes/productId";
import productTypes from "./routes/productTypes";
import productall from "./routes/product_all";
import register from "./routes/register";
import reviews from "./routes/reviews";
import transfer from './routes/transfer';
import updateProfile from './routes/update-profile';
import upload from './routes/upload';
import zipcode from './routes/zipcode';




export const app = express();
app.use(cors({
	origin: process.env.CLIENT_ORIGIN,
	credentials: true,
}));
app.use('/profiles', express.static(path.join(__dirname, 'public', 'profiles')));
app.use('/slips', express.static(path.join(__dirname, 'public', 'slips')));
app.use('/qrs', express.static(path.join(__dirname, 'public', 'qrs')));
app.use('/products', express.static(path.join(__dirname, 'public/products')));




app.use(cookieParser());
app.use(bodyParser.json());




app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export const handler = ServerlessHttp(app);

export const pool = createPool({
	connectionLimit: 1,
	host: process.env.DB_HOST,
	port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
});

app.get("/", (req, res) => {
	res.status(200).json({
		status: "OK",
		request: { params: req.params, query: req.query, body: req.body },
	});
});
app.use(register);
app.use(login);
app.use(productall);
app.use(customerall);
app.use("/", productID);
app.use(reviews);
app.use(me);
app.use(updateProfile);
app.use(changePassword);
app.use('/zipcode', zipcode);
app.use(orders);
app.use(transfer);
app.use(payment);
app.use(upload);
app.use(productTypes);
app.use('/admin/reviews', adminReview);
app.use('/favorites', favorites);





app.use(errorHandler);
