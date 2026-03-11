import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import OfficeDashboard from "./pages/OfficeDashboard";
import Calendar from "./pages/Calendar";
import Offices from "./pages/Offices";
import AddEventPage from "./pages/AddEventPage";
import ArchivedEventsPage from "./pages/ArchivedEventsPage";
import ProtectedRoute from "./ProtectedRoute";
import { clearToken, getToken, getUserFromToken, onAuthChange } from "./auth";
import Modal from "./components/Modal";

function Shell() {
  const [user, setUser] = useState<any | null>(getUserFromToken());
  const loc = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const unsub = onAuthChange(() => {
      const t = getToken();
      if (!t) {
        setUser(null);
        return;
      }
      fetch("/api/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setUser(d ?? getUserFromToken()));
    });
    const t = getToken();
    if (t) {
      fetch("/api/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setUser(d ?? getUserFromToken()));
    }
    return () => { unsub(); };
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    const t = getToken();
    if (t && !user) {
      fetch("/api/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setUser(d ?? getUserFromToken()));
    }
  }, [loc.pathname]);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <nav style={{ display: "flex", gap: 16, padding: 12, borderBottom: "1px solid var(--border)", alignItems: "center", background: "var(--card)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <img src="/logo.png" alt="DENR" style={{ width: 36, height: 36, objectFit: "contain" }} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>DENR Planner</span>
            <span style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.1 }}>Department of Environment and Natural Resources - CAR</span>
          </span>
        </Link>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span
            aria-label="Current date and time"
            title="Current date and time"
            style={{
              fontSize: 14,
              color: "#334155",
              padding: "6px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {user ? (
            <>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
                <span>{user.officeName ? user.officeName : user.sub}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{user.service || "Top-level Offices"}</span>
              </span>
              <button onClick={() => { clearToken(); window.location.assign("/"); }}>Logout</button>
            </>
          ) : (
            <button onClick={() => setShowLogin(true)}>Login</button>
          )}
        </span>
      </nav>
      <Modal open={showLogin} onClose={() => setShowLogin(false)}>
        <Login
          onSuccess={(u) => {
            setShowLogin(false);
            navigate("/office-dashboard");
          }}
        />
      </Modal>
      {user && (
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
          {[
            { to: "/office-dashboard", label: "Office Dashboard" },
            { to: "/add-event", label: "Add Event" },
            { to: "/archived", label: "Archived" }
          ].map((t) => {
            const active = location.pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: active ? "2px solid #2563eb" : "1px solid var(--border)",
                  background: active ? "#dbeafe" : "transparent",
                  fontWeight: 600,
                  color: "inherit"
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/offices"
            element={
              <ProtectedRoute>
                <Offices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/office-dashboard"
            element={
              <ProtectedRoute>
                <OfficeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archived"
            element={
              <ProtectedRoute>
                <ArchivedEventsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-event"
            element={
              <ProtectedRoute>
                <AddEventPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
      <footer style={{ marginTop: "auto", padding: 12, textAlign: "center", color: "var(--muted)", background: "var(--card)", borderTop: "1px solid var(--border)" }}>
        <div>© 2026 DENR Planner- Department of Environment and Natural Resources - CAR</div>
        <div>Committed to Sustainable Environmental Management</div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
