import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import Landing from "./pages/Landing";
import OfficeDashboard from "./pages/OfficeDashboard";
import Calendar from "./pages/Calendar";
import Offices from "./pages/Offices";
import AddEventPage from "./pages/AddEventPage";
import ArchivedEventsPage from "./pages/ArchivedEventsPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import UserManagement from "./pages/UserManagement";
import EventManagement from "./pages/EventManagement";
import AdminSettings from "./pages/AdminSettings";
import ProtectedRoute from "./ProtectedRoute";
import { clearToken, getToken, getUserFromToken, onAuthChange } from "./auth";
import LoginModal from "./components/LoginModal";
import { api } from "./api";

function NotFoundRedirect() {
  const navigate = useNavigate();
  const user = getUserFromToken();

  useEffect(() => {
    if (user) {
      navigate("/office-dashboard");
    } else {
      navigate("/");
    }
  }, [user, navigate]);

  return null;
}

function Shell() {
  const [user, setUser] = useState<any | null>(getUserFromToken());
  const [isPortrait, setIsPortrait] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function abbreviateOffice(name: string) {
    if (!name) return "";
    const n = name.trim();
    const map: Record<string, string> = {
      "Office of the Regional Director": "ORD",
      "Office of the Assistant Regional Director for Management Services": "ARD-MS",
      "Office of the Assistant Regional Director for Technical Services": "ARD-TS",
      "Surveys and Mapping Division": "SMD",
      "Licenses, Patents and Deeds Division": "LPDD",
      "Conservation and Development Division": "CDD",
      "Enforcement Division": "ED",
      "Planning and Management Division": "PMD",
      "Legal Division": "Legal",
      "Administrative Division": "Admin",
      "Finance Division": "Finance"
    };
    if (map[n]) return map[n];
    // Case-insensitive fallback
    const entry = Object.entries(map).find(([k]) => k.toLowerCase() === n.toLowerCase());
    return entry ? entry[1] : n;
  }

  useEffect(() => {
    function update() {
      try {
        const m = window.matchMedia && window.matchMedia("(orientation: portrait)");
        const isSmall = window.innerWidth < 768;
        setIsPortrait(isSmall || (m ? m.matches : window.innerHeight >= window.innerWidth));
      } catch {
        setIsPortrait(true);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const unsub = onAuthChange(() => {
      const t = getToken();
      if (!t) {
        setUser(null);
        return;
      }
      api.get("/api/me").then((d) => setUser(d ?? getUserFromToken()));
    });
    const t = getToken();
    if (t) {
      api.get("/api/me").then((d) => setUser(d ?? getUserFromToken()));
    }
    return () => { unsub(); };
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    
    // Heartbeat check for token validity every 5 minutes
    const authId = window.setInterval(() => {
      const t = getToken();
      if (t) {
        api.get("/api/me").catch(() => {
          // api helper handles 401 redirect
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(id);
      window.clearInterval(authId);
    };
  }, []);
  useEffect(() => {
    const t = getToken();
    if (t && !user) {
      api.get("/api/me").then((d) => setUser(d ?? getUserFromToken()));
    }
  }, [loc.pathname]);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <nav style={{ display: "flex", gap: isPortrait ? 8 : 16, padding: isPortrait ? "8px 12px" : 12, borderBottom: "1px solid var(--border)", alignItems: "center", background: "var(--nav-bg)", color: "white", flexWrap: "wrap" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: isPortrait ? 8 : 12, textDecoration: "none", color: "inherit" }}>
          <img src="/logo.png" alt="DENR" style={{ width: isPortrait ? 28 : 36, height: isPortrait ? 28 : 36, objectFit: "contain" }} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, fontSize: isPortrait ? 16 : 18, lineHeight: 1 }}>{isPortrait ? "DENR" : "DENR Planner"}</span>
            <span style={{ fontSize: isPortrait ? 10 : 12, color: "rgba(255,255,255,0.8)", marginTop: 2, lineHeight: 1.1 }}>{isPortrait ? "DENR-CAR" : "Department of Environment and Natural Resources - CAR"}</span>
          </span>
        </Link>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <span
            aria-label="Current date and time"
            title="Current date and time"
            style={{
              fontSize: isPortrait ? 11 : 14,
              color: "white",
              padding: isPortrait ? "4px 6px" : "6px 10px",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.1)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap"
            }}
          >
            {isPortrait 
              ? `${now.toLocaleDateString(undefined, { month: "short", day: "numeric" })} • ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}`
              : `${now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} • ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}`
            }
          </span>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
            title="Toggle theme"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              padding: 0
            }}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 0 }}>
          {user ? (
            <>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
                <span style={{ fontSize: isPortrait ? 12 : 14, fontWeight: 600 }}>{user.officeName ? (isPortrait ? abbreviateOffice(user.officeName) : user.officeName) : user.sub}</span>
                {!isPortrait && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{user.service || "Top-level Offices"}</span>}
              </span>
              <button style={{ padding: isPortrait ? "4px 8px" : "8px 16px", fontSize: isPortrait ? 12 : 14, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }} onClick={() => { clearToken(); window.location.assign("/"); }}>Logout</button>
            </>
          ) : (
            <button style={{ padding: isPortrait ? "4px 8px" : "8px 16px", fontSize: isPortrait ? 12 : 14, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }} onClick={() => setShowLogin(true)}>Login</button>
          )}
        </span>
      </nav>
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={(u) => {
          setUser(u);
          navigate("/office-dashboard");
        }}
      />
      {user && (
        <div style={{ display: "flex", gap: isPortrait ? 4 : 8, padding: isPortrait ? "4px 8px" : "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--card)", overflowX: "auto" }}>
          {[
            { to: "/office-dashboard", label: "Office Dashboard", short: "Dashboard" },
            { to: "/add-event", label: "Add Event", short: "Add" },
            { to: "/archived", label: "Archived", short: "Archived" },
            ...(String(user.role || "").includes("ADMIN") ? [{ to: "/admin", label: "Admin Panel", short: "Admin" }] : [])
          ].map((t) => {
            const active = location.pathname === t.to || (t.to === "/admin" && location.pathname.startsWith("/admin"));
            return (
              <Link
                key={t.to}
                to={t.to}
                style={{
                  padding: isPortrait ? "6px 8px" : "8px 12px",
                  borderRadius: 8,
                  border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: active ? "rgba(10, 75, 57, 0.15)" : "transparent",
                  fontWeight: 600,
                  color: "inherit",
                  fontSize: isPortrait ? 12 : 14,
                  whiteSpace: "nowrap"
                }}
              >
                {isPortrait ? t.short : t.label}
              </Link>
            );
          })}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar/>
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
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="ADMIN">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="ADMIN">
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events"
            element={
              <ProtectedRoute role="ADMIN">
                <EventManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute role="ADMIN">
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </div>
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
