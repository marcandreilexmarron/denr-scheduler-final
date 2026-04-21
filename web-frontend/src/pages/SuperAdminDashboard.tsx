import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api } from "../api";
import { Users, Calendar, Settings, BarChart3 } from "lucide-react";

export default function SuperAdminDashboard() {
  const user = getUserFromToken();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is ADMIN
  if (!user || !String(user.role || "").includes("ADMIN")) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <p>Access denied. Only ADMIN users can access this page.</p>
      </div>
    );
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await api.get("/api/admin/stats");
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
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
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
          SuperAdmin Dashboard
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Welcome, {user.sub}. Manage the entire system from here.
        </p>
      </div>

      {/* Statistics Section */}
      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading statistics...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", color: "red", background: "rgba(255,0,0,0.1)", borderRadius: "8px" }}>
          Error: {error}
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

      {/* Admin Modules */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
          Admin Modules
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

      {/* Quick Info Section */}
      {stats && (
        <div style={{
          padding: "20px",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          background: "var(--card)",
          marginBottom: "20px"
        }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px" }}>
            <BarChart3 size={20} style={{ marginRight: "8px", verticalAlign: "middle" }} />
            System Overview
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Users by Role</p>
              <div style={{ fontSize: "14px", fontWeight: "500" }}>
                ADMIN: {stats.adminUsers} | OFFICE: {stats.officeUsers}
              </div>
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Event Distribution</p>
              <div style={{ fontSize: "14px", fontWeight: "500" }}>
                Active: {stats.totalEvents} | Archived: {stats.totalArchivedEvents}
              </div>
            </div>
          </div>
        </div>
      )}
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
