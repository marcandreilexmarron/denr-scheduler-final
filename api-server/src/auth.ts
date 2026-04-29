import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const secret = process.env.JWT_SECRET || "dev-insecure-secret";

export function signToken(payload: object) {
  return jwt.sign(payload, secret, { expiresIn: "24h" });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

export function authMiddlewareAllowQuery(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    const q = (req.query as any)?.token;
    if (typeof q === "string" && q.trim()) token = q.trim();
  }
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as any;
    const norm = (r: any) => String(r || "").replace(/^ROLE_/, "");
    if (!user || norm(user.role) !== norm(role)) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

export function requireAnyRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as any;
    const norm = (r: any) => String(r || "").replace(/^ROLE_/, "");
    const has = user && roles.map(norm).includes(norm(user.role));
    if (!has) return res.status(403).json({ error: "forbidden" });
    next();
  };
}
