import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import OfficeDashboard from "./pages/OfficeDashboard";
import Calendar from "./pages/Calendar";
import Offices from "./pages/Offices";
import ProtectedRoute from "./ProtectedRoute";
import { clearToken, getToken, getUserFromToken, onAuthChange } from "./auth";
import Modal from "./components/Modal";

function Shell() {
  const [user, setUser] = useState<any | null>(getUserFromToken());
  const loc = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
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
    const t = getToken();
    if (t && !user) {
      fetch("/api/me", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setUser(d ?? getUserFromToken()));
    }
  }, [loc.pathname]);
  return (
    <>
      <nav style={{ display: "flex", gap: 16, padding: 12, borderBottom: "1px solid #ddd", alignItems: "center" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <img src="/logo.png" alt="DENR" style={{ width: 36, height: 36, objectFit: "contain" }} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>DENR Planner</span>
            <span style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.1 }}>Department of Environment and Natural Resources</span>
          </span>
        </Link>
        <div style={{ display: "flex", gap: 12, marginLeft: 16 }}>
          {user && (
            <>
              {user?.role?.endsWith("ADMIN") && <Link to="/admin">Admin</Link>}
              <Link to="/office-dashboard">Office Dashboard</Link>
              <Link to="/offices">Offices</Link>
            </>
          )}
        </div>
        <span style={{ marginLeft: "auto" }}>
          {user ? (
            <>
              <span style={{ marginRight: 8 }}>
                {user.officeName ? `${user.officeName}` : user.sub} ({user.service || "Top-level Offices"})
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
            if (String(u?.role || "").endsWith("ADMIN")) navigate("/admin");
            else navigate("/office-dashboard");
          }}
        />
      </Modal>
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
          path="/admin"
          element={
            <ProtectedRoute role="ADMIN">
              <Admin />
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
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
