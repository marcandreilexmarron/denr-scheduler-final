import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { readUsers } from "./storage-select.js";

const secret: Secret = (() => {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.trim()) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "dev-insecure-secret";
})();

export function signToken(payload: object) {
  return jwt.sign(payload, secret, { expiresIn: "24h" } as SignOptions);
}

export function signTokenWithExpiry(payload: object, expiresIn: SignOptions["expiresIn"]) {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function verifyToken(token: string): any | null {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
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

// Middleware to check if user is disabled
export async function checkUserDisabled(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as any;
  if (!user || !user.sub) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const users = await readUsers();
    const dbUser = users.find((u: any) => u.username === user.sub);
    if (!dbUser || dbUser.disabled) {
      return res.status(403).json({ error: "account_disabled" });
    }
    next();
  } catch (err) {
    console.error("Error checking user status:", err);
    res.status(500).json({ error: "internal_server_error" });
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
