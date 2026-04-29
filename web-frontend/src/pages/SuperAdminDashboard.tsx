import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api, subscribeAdminEvents } from "../api";
import { Users, Calendar, Settings, BarChart3, Activity, RefreshCw } from "lucide-react";

export default function SuperAdminDashboard() {
  const user = getUserFromToken();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "error">("connected");
  const [refreshing, setRefreshing] = useState(false);

  // Check if user is ADMIN
  if (!user || !String(user.role || "").includes("ADMIN")) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <p>Access denied. Only ADMIN users can access this page.</p>
      </div>
    );
  }

  const fetchStats = async () => {
    const data = await api.get("/api/admin/stats");
    setStats(data);
  };

  const fetchAudit = async () => {
    const data = await api.get("/api/admin/audit?limit=12");
    setAudit(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setAuditLoading(true);
        await Promise.all([fetchStats(), fetchAudit()]);
        if (mounted) setError(null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
      } finally {
        if (mounted) {
          setLoading(false);
          setAuditLoading(false);
        }
      }
    })();

    const unsub = subscribeAdminEvents(
      (payload) => {
        const type = payload?.type;
        if (typeof type !== "string") return;
        if (type === "hello" || type === "ping") return;
        fetchStats().catch(() => {});
        fetchAudit().catch(() => {});
      },
      (s) => setRealtimeStatus(s)
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const modules = [
    {
      title: "User Management",
      description: "Manage user accounts, roles, and permissions",
      icon: <Users size={32} />,
      color: "#3b82f6",
      path: "/admin/users"
    },
    {
      title: "Event Management",
      description: "View and manage all events in the system",
      icon: <Calendar size={32} />,
      color: "#10b981",
      path: "/admin/events"
    },
    {
      title: "System Settings",
      description: "Configure holidays, system parameters, and settings",
      icon: <Settings size={32} />,
      color: "#f59e0b",
      path: "/admin/settings"
    }
  ];

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "18px", display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "6px", marginTop: 0 }}>
            Admin Panel
          </h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Signed in as <span style={{ fontWeight: 600 }}>{user.sub}</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            title={realtimeStatus === "connected" ? "Realtime connected" : "Realtime disconnected (using manual refresh)"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 13,
              color: "var(--muted)"
            }}
          >
            <Activity size={16} style={{ color: realtimeStatus === "connected" ? "#16a34a" : "#dc2626" }} />
            {realtimeStatus === "connected" ? "Realtime" : "Offline"}
          </div>
          <button
            onClick={async () => {
              try {
                setRefreshing(true);
                await Promise.all([fetchStats(), fetchAudit()]);
                setError(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to refresh");
              } finally {
                setRefreshing(false);
              }
            }}
            style={{
              padding: "10px 14px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 600,
              color: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: refreshing ? 0.7 : 1
            }}
            title="Refresh admin dashboard"
            disabled={refreshing}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "var(--error-bg)", border: "1px solid var(--error-border)", borderRadius: "10px", color: "var(--error-color)", marginBottom: "16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading statistics...
        </div>
      ) : stats ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "30px"
        }}>
          <StatCard icon={<Users size={24} />} title="Total Users" value={stats.totalUsers} />
          <StatCard icon={<Users size={24} />} title="Admin Users" value={stats.adminUsers} color="#f59e0b" />
          <StatCard icon={<Users size={24} />} title="Office Users" value={stats.officeUsers} color="#10b981" />
          <StatCard icon={<Calendar size={24} />} title="Active Events" value={stats.totalEvents} color="#3b82f6" />
          <StatCard icon={<Calendar size={24} />} title="Archived Events" value={stats.totalArchivedEvents} color="#8b5cf6" />
          <StatCard icon={<Settings size={24} />} title="Holidays" value={stats.totalHolidays} color="#ec4899" />
        </div>
      ) : null}

      <div style={{ marginBottom: "26px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px" }}>
          Modules
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px"
        }}>
          {modules.map((module, idx) => (
            <div
              key={idx}
              onClick={() => navigate(module.path)}
              style={{
                padding: "20px",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                cursor: "pointer",
                background: "var(--card)",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = module.color;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${module.color}20`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ color: module.color }}>
                {module.icon}
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "4px" }}>
                  {module.title}
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  {module.description}
                </p>
              </div>
              <div style={{ marginTop: "8px", color: module.color, fontWeight: "500", fontSize: "14px" }}>
                → Access Module
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ padding: "18px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart3 size={18} />
            System Overview
          </h3>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
            <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--secondary-bg)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Users</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Admin: {stats?.adminUsers ?? "-"} • Office: {stats?.officeUsers ?? "-"}
              </div>
            </div>
            <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--secondary-bg)" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Events</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Active: {stats?.totalEvents ?? "-"} • Archived: {stats?.totalArchivedEvents ?? "-"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "18px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={18} />
            Activity
          </h3>
          <div style={{ marginTop: 14 }}>
            {auditLoading ? (
              <div style={{ padding: "14px 0", color: "var(--muted)" }}>Loading activity...</div>
            ) : audit.length === 0 ? (
              <div style={{ padding: "14px 0", color: "var(--muted)" }}>No recent activity.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {audit.slice(0, 8).map((a) => (
                  <div key={a.id} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 10, background: "var(--secondary-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{String(a.action || "activity")}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {a.at ? new Date(a.at).toLocaleString() : ""}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                      {(a.actor ? `By ${a.actor}` : "System")}{a.meta?.username ? ` • ${a.meta.username}` : ""}{a.meta?.eventId ? ` • ${a.meta.eventId}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: number | string; color?: string }) {
  return (
    <div style={{
      padding: "16px",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      background: "var(--card)",
      textAlign: "center"
    }}>
      <div style={{ color: color || "var(--text-secondary)", marginBottom: "8px" }}>
        {icon}
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
        {title}
      </p>
      <p style={{ fontSize: "24px", fontWeight: "700", color: color || "inherit" }}>
        {value}
      </p>
    </div>
  );
}
