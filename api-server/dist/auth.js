import jwt from "jsonwebtoken";
const secret = (() => {
    const configured = process.env.JWT_SECRET;
    if (configured && configured.trim())
        return configured;
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET must be set in production");
    }
    return "dev-insecure-secret";
})();
export function signToken(payload) {
    return jwt.sign(payload, secret, { expiresIn: "24h" });
}
export function signTokenWithExpiry(payload, expiresIn) {
    return jwt.sign(payload, secret, { expiresIn });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, secret);
    }
    catch {
        return null;
    }
}
export function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token)
        return res.status(401).json({ error: "unauthorized" });
    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: "unauthorized" });
    }
}
export function authMiddlewareAllowQuery(req, res, next) {
    const header = req.headers.authorization || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        const q = req.query?.token;
        if (typeof q === "string" && q.trim())
            token = q.trim();
    }
    if (!token)
        return res.status(401).json({ error: "unauthorized" });
    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: "unauthorized" });
    }
}
export function requireRole(role) {
    return (req, res, next) => {
        const user = req.user;
        const norm = (r) => String(r || "").replace(/^ROLE_/, "");
        if (!user || norm(user.role) !== norm(role))
            return res.status(403).json({ error: "forbidden" });
        next();
    };
}
export function requireAnyRole(roles) {
    return (req, res, next) => {
        const user = req.user;
        const norm = (r) => String(r || "").replace(/^ROLE_/, "");
        const has = user && roles.map(norm).includes(norm(user.role));
        if (!has)
            return res.status(403).json({ error: "forbidden" });
        next();
    };
}
