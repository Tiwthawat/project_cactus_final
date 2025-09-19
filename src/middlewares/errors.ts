import { isBoom } from "@hapi/boom";
import bodyParser from "body-parser";
import express, { NextFunction, Request, Response } from "express";

const app = express();
app.use(bodyParser.json());

const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // พิมพ์ข้อผิดพลาดใน console หากอยู่ในโหมดพัฒนา
    if (process.env.NODE_ENV === "development") {
        console.error(err);
    }

    // เช็คว่าเป็น Boom error หรือไม่
    if (isBoom(err)) {
        return res.status(err.output.statusCode).send({ errors: [{ message: err.message }] });
    }

    // ถ้าไม่ใช่ Boom error
    res.status(500).send({ errors: [{ message: "Something went wrong" }] });
};

export default errorHandler;
