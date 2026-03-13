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
  const [isPortrait, setIsPortrait] = useState<boolean>(true);
  useEffect(() => {
    function update() {
      try {
        const m = window.matchMedia && window.matchMedia("(orientation: portrait)");
        setIsPortrait(m ? m.matches : window.innerHeight >= window.innerWidth);
      } catch {
        setIsPortrait(true);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  function abbreviate(s: string) {
    if (!s) return s;
    const map: Record<string, string> = {
      "department of environment and natural resources - car": "DENR-CAR",
      "office of the regional director": "ORD",
      "office of the assistant regional director for management services": "OARD-MS",
      "office of the assistant regional director for technical services": "OARD-TS",
      "technical services": "TS",
      "management services": "MS",
      "surveys and mapping division": "SMD",
      "licenses, patents and deeds division": "LPDD",
      "conservation and development division": "CDD",
      "enforcement division": "ED",
      "planning and management division": "PMD",
      "legal division": "LD",
      "administrative division": "AD",
      "finance division": "FD",
      "top-level offices": "TLO",
      "regional office": "RO",
      "planning and management": "PMD",
      "administrative": "AD",
      "finance": "FD",
      "legal": "LD",
      "enforcement": "ED",
      "surveys and mapping": "SMD",
      "licenses, patents and deeds": "LPDD",
      "conservation and development": "CDD"
    };
    // Normalize string: lowercase, trim, and collapse multiple spaces/newlines into one space
    const key = s.toLowerCase().trim().replace(/\s+/g, " ");
    if (map[key]) return map[key];
    // Fallback: try removing " division" or " service"
    const cleaned = key.replace(/\s+(division|service)$/, "");
    return map[cleaned] || s;
  }

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
      <nav style={{
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
        gap: isPortrait ? 8 : 16,
        padding: 12,
        borderBottom: "1px solid var(--border)",
        alignItems: isPortrait ? "stretch" : "center",
        background: "var(--card)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: isPortrait ? "100%" : "auto" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
            <img src="/logo.png" alt="DENR" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>DENR Planner</span>
              <span style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.1 }}>
                {isPortrait ? abbreviate("Department of Environment and Natural Resources - CAR") : "Department of Environment and Natural Resources - CAR"}
              </span>
            </span>
          </Link>
          {isPortrait && user && (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
                <span>{abbreviate(user.officeName || user.sub)}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{abbreviate(user.service || "Top-level Offices")}</span>
              </span>
              <button onClick={() => { clearToken(); window.location.assign("/"); }}>Logout</button>
            </span>
          )}
          {isPortrait && !user && (
            <button onClick={() => setShowLogin(true)}>Login</button>
          )}
        </div>
        <div style={{
          marginLeft: isPortrait ? 0 : "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: isPortrait ? "center" : "flex-start",
          gap: 16,
          width: isPortrait ? "100%" : "auto"
        }}>
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
              fontVariantNumeric: "tabular-nums",
              flex: isPortrait ? 1 : "initial",
              textAlign: "center"
            }}
          >
            {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
        </div>
        {!isPortrait && (
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
        )}
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
        <div style={{
          display: "flex",
          flexWrap: isPortrait ? "wrap" : "nowrap",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--card)"
        }}>
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
                  color: "inherit",
                  flex: isPortrait ? "1 1 calc(50% - 8px)" : "initial",
                  textAlign: "center"
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
      <footer style={{ marginTop: "auto", padding: isPortrait ? 8 : 12, textAlign: "center", color: "var(--muted)", background: "var(--card)", borderTop: "1px solid var(--border)", fontSize: isPortrait ? 12 : 14 }}>
        <div>© 2026 DENR Planner- {isPortrait ? abbreviate("Department of Environment and Natural Resources - CAR") : "Department of Environment and Natural Resources - CAR"}</div>
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
