import "express";

declare module "express" {
    interface Request {
        user?: {
            Cid: number;
            Cusername: string;
            Cstatus: string;
            iat?: number;
            exp?: number;
        };
    }
}
