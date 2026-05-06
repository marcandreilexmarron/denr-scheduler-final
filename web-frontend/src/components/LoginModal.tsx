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
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ field?: "username" | "password" | "code"; message: string } | null>(null);
  const navigate = useNavigate();

  function finalizeLogin(token: string) {
    setError(null);
    saveToken(token);
    const user = getUserFromToken();
    if (onSuccess) {
      onSuccess(user);
    } else {
      navigate("/office-dashboard");
    }
    onClose();
  }

  function startLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    api.post("/api/login/start", { username, password })
      .then((d) => {
        if (d && typeof d.token === "string" && d.token) {
          finalizeLogin(d.token);
          return;
        }
        if (d && d.twoFactorRequired && typeof d.tempToken === "string" && d.tempToken) {
          setTempToken(d.tempToken);
          setMaskedEmail(typeof d.email === "string" ? d.email : "");
          setCode("");
          setStep("code");
          setError(null);
          return;
        }
        setError({ message: "Login failed" });
      })
      .catch((err) => {
        if (err && typeof err === "object" && "status" in err) {
          const st = (err as any).status;
          if (st === 404) setError({ field: "username", message: "Username not found" });
          else if (st === 401) setError({ field: "password", message: "Incorrect password" });
          else if (st === 403) setError({ message: "This user is disabled. Contact an admin." });
          else if (st === 400) setError({ message: "No email is set for this user. Contact an admin to add an email for 2FA." });
          else if (st === 429) setError({ message: "Please wait a moment before requesting another code." });
          else if (st === 409) setError({ message: "Two-factor verification is required. Please use the latest login screen." });
          else setError({ message: (err as any).message || "Login failed" });
        } else {
          setError({ message: "Login failed" });
        }
      })
      .finally(() => setSubmitting(false));
  }

  function verifyLogin(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    api.post("/api/login/verify", { tempToken, code })
      .then((d) => {
        if (d && typeof d.token === "string" && d.token) {
          finalizeLogin(d.token);
          return;
        }
        setError({ message: "Verification failed" });
      })
      .catch((err) => {
        if (err && typeof err === "object" && "status" in err) {
          const st = (err as any).status;
          if (st === 401) setError({ field: "code", message: "Invalid verification code" });
          else if (st === 410) setError({ message: "Verification code expired. Please go back and login again to request a new code." });
          else if (st === 429) setError({ message: "Too many attempts. Please login again to request a new code." });
          else setError({ message: (err as any).message || "Verification failed" });
        } else {
          setError({ message: "Verification failed" });
        }
      })
      .finally(() => setSubmitting(false));
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
        {step === "credentials" ? (
          <form onSubmit={startLogin} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
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
            <button type="submit" disabled={submitting} style={{ width: "100%", padding: "10px 12px", background: "var(--primary)", color: "white", fontWeight: 600, fontSize: 15, opacity: submitting ? 0.8 : 1 }}>
              {submitting ? "Sending code..." : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyLogin} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Enter the 6-digit code sent to {maskedEmail || "your email"}.
            </div>
            <div>
              <label htmlFor="code" style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Verification code</label>
              <input
                id="code"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (error) setError(null);
                }}
                style={{ width: "100%", padding: "10px 12px", fontSize: 16, letterSpacing: 4, textAlign: "center", borderColor: error?.field === "code" ? "var(--error-color)" : undefined }}
                autoFocus
              />
              {error?.field === "code" && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 4 }}>{error.message}</div>}
            </div>
            <button type="submit" disabled={submitting || code.length !== 6} style={{ width: "100%", padding: "10px 12px", background: "var(--primary)", color: "white", fontWeight: 600, fontSize: 15, opacity: submitting || code.length !== 6 ? 0.8 : 1 }}>
              {submitting ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setTempToken("");
                setMaskedEmail("");
                setCode("");
                setError(null);
              }}
              style={{ width: "100%", padding: "10px 12px", background: "var(--card)", border: "1px solid var(--border)", color: "inherit", fontWeight: 600, fontSize: 14 }}
              disabled={submitting}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
