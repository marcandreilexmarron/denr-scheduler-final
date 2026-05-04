import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveToken, getUserFromToken } from "../auth";
import { api } from "../api";
import Modal from "./Modal";

export default function LoginModal({
  open,
  onClose,
  onSuccess
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: (user: any) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field?: "username" | "password"; message: string } | null>(null);
  const navigate = useNavigate();

  function login(e: React.FormEvent) {
    e.preventDefault();
    api.post("/api/login", { username, password })
      .then((d) => {
        setError(null);
        saveToken(d.token);
        const user = getUserFromToken();
        if (onSuccess) {
          onSuccess(user);
        } else {
          navigate("/office-dashboard");
        }
        onClose();
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
    <Modal open={open} onClose={onClose} style={{ width: 480, maxWidth: "calc(100vw - 32px)" }}>
      <div style={{ padding: "8px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <img src="/logo.png" alt="" aria-hidden style={{ width: 96, height: 96, objectFit: "contain", opacity: 0.95 }} />
          <h2 style={{ margin: "12px 0 4px 0", lineHeight: 1.2, fontSize: 24 }}>DENR-CAR Planner</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Login to schedule an event.</div>
        </div>
        {error && (
          <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid var(--error-border)", background: "var(--error-bg)", color: "var(--error-color)", borderRadius: 8, fontSize: 13 }}>
            {error.message}
          </div>
        )}
        <form onSubmit={login} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <label htmlFor="username" style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Username</label>
            <input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (error) setError(null); }}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderColor: error?.field === "username" ? "var(--error-color)" : undefined }}
              autoFocus
            />
            {error?.field === "username" && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 4 }}>{error.message}</div>}
          </div>
          <div>
            <label htmlFor="password" style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Password</label>
            <input
              id="password"
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderColor: error?.field === "password" ? "var(--error-color)" : undefined }}
            />
            {error?.field === "password" && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 4 }}>{error.message}</div>}
          </div>
          <button type="submit" style={{ width: "100%", padding: "10px 12px", background: "var(--primary)", color: "white", fontWeight: 600, fontSize: 15 }}>Login</button>
        </form>
      </div>
    </Modal>
  );
}
