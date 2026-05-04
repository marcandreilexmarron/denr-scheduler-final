import jwt from "jsonwebtoken";
const secret = process.env.JWT_SECRET || "dev-insecure-secret";
export function signToken(payload) {
    return jwt.sign(payload, secret, { expiresIn: "24h" });
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
