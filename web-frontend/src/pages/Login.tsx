import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveToken, getUserFromToken } from "../auth";

export default function Login({ onSuccess }: { onSuccess?: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field?: "username" | "password"; message: string } | null>(null);
  const navigate = useNavigate();
  function login(e: React.FormEvent) {
    e.preventDefault();
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
      .then(async (r) => {
        if (!r.ok) {
          let msg = "";
          try {
            const j = await r.json();
            msg = j?.message || "";
          } catch {}
          throw { status: r.status, message: msg };
        }
        return r.json();
      })
      .then((d) => {
        setError(null);
        saveToken(d.token);
        const user = getUserFromToken();
        if (onSuccess) {
          onSuccess(user);
          return;
        }
        navigate("/office-dashboard");
      })
      .catch((err) => {
        if (err && typeof err === "object" && "status" in err) {
          const st = (err as any).status;
          if (st === 404) setError({ field: "username", message: "Username not found" });
          else if (st === 401) setError({ field: "password", message: "Incorrect password" });
          else setError({ message: (err as any).message || "Login failed" });
        } else {
          setError({ message: "Login failed" });
        }
      });
  }
  return (
    <div style={{ padding: 0, minWidth: 320 }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <img src="/logo.png" alt="" aria-hidden style={{ width: 56, height: 56, objectFit: "contain", opacity: 0.95 }} />
          <h2 style={{ margin: "8px 0 4px 0", lineHeight: 1.2 }}>Log in</h2>
        </div>
        {error && (
          <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fee2e2", color: "#7f1d1d", borderRadius: 8, fontSize: 14 }}>
            {error.message}
          </div>
        )}
        <form onSubmit={login} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label htmlFor="username" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Username</label>
            <input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }}
              style={{ width: "100%", borderColor: error?.field === "username" ? "#dc2626" : undefined }}
              autoFocus
            />
            {error?.field === "username" && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{error.message}</div>}
          </div>
          <div>
            <label htmlFor="password" style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Password</label>
            <input
              id="password"
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              style={{ width: "100%", borderColor: error?.field === "password" ? "#dc2626" : undefined }}
            />
            {error?.field === "password" && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{error.message}</div>}
          </div>
          <button type="submit" style={{ width: "100%", padding: "10px 12px", background: "var(--primary)", color: "white", fontWeight: 600 }}>Login</button>
        </form>
      </div>
    </div>
  );
}
