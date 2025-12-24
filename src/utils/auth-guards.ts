import { type AdminTokenPayload, type AuthedRequest, type CustomerTokenPayload, type TokenPayload } from "../middlewares/auth";

export function requireUser(req: AuthedRequest): TokenPayload | null {
    return req.user ?? null;
}

export function requireCustomer(req: AuthedRequest): CustomerTokenPayload | null {
    const u = req.user;
    if (!u) return null;
    return u.role === "user" ? u : null;
}

export function requireAdmin(req: AuthedRequest): AdminTokenPayload | null {
    const u = req.user;
    if (!u) return null;
    return u.role === "admin" ? u : null;
}
