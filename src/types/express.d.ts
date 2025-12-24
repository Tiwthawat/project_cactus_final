import type { TokenPayload } from "../middlewares/auth";

declare module "express" {
    interface Request {
        user?: TokenPayload;
    }
}

export { };

