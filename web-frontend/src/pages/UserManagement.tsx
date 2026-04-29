import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api, subscribeAdminEvents } from "../api";
import { Plus, Edit2, Trash2, KeyRound, Ban, CheckCircle2, Activity, RefreshCw, Copy } from "lucide-react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";

export default function UserManagement() {
  const user = getUserFromToken();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    username: "",
    password: "",
    email: "",
    role: "OFFICE",
    officeName: "",
    service: ""
  });
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "OFFICE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "error">("connected");
  const [refreshing, setRefreshing] = useState(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: (() => void) | null }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });
  const [passwordResult, setPasswordResult] = useState<{ open: boolean; username: string; password: string }>({
    open: false,
    username: "",
    password: ""
  });

  // Check if user is ADMIN
  if (!user || !String(user.role || "").includes("ADMIN")) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <p>Access denied. Only ADMIN users can access this page.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchUsers();

    const unsub = subscribeAdminEvents(
      (payload) => {
        const type = payload?.type;
        if (typeof type !== "string") return;
        if (!type.startsWith("user.")) return;
        fetchUsers().catch(() => {});
      },
      (s) => setRealtimeStatus(s)
    );

    return () => unsub();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/admin/users");
      setUsers(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.username || !formData.password) {
      setError("Username and password are required");
      return;
    }
    const email = String(formData.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email is invalid");
      return;
    }
    try {
      await api.post("/api/admin/users", formData);
      await fetchUsers();
      setShowAddModal(false);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser?.username) return;
    try {
      const updateData = { ...formData };
      // Don't send empty password
      if (!updateData.password) {
        delete updateData.password;
      }
      const email = String(updateData.email || "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Email is invalid");
        return;
      }
      await api.put(`/api/admin/users/${editingUser.username}`, updateData);
      await fetchUsers();
      setEditingUser(null);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleDeleteUser = (username: string) => {
    setConfirmState({
      open: true,
      title: "Delete user",
      message: `Delete user "${username}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/users/${username}`);
          await fetchUsers();
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to delete user");
        }
      }
    });
  };

  const handleToggleDisabled = (u: any) => {
    const nextDisabled = !Boolean(u.disabled);
    setConfirmState({
      open: true,
      title: nextDisabled ? "Disable user" : "Enable user",
      message: nextDisabled
        ? `Disable "${u.username}"? They will not be able to log in until re-enabled.`
        : `Enable "${u.username}"? They will be able to log in again.`,
      onConfirm: async () => {
        try {
          await api.put(`/api/admin/users/${u.username}`, { disabled: nextDisabled });
          await fetchUsers();
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update user status");
        }
      }
    });
  };

  const handleResetPassword = (u: any) => {
    setConfirmState({
      open: true,
      title: "Reset password",
      message: `Reset password for "${u.username}"? A new password will be generated and shown once.`,
      onConfirm: async () => {
        try {
          const result = await api.post(`/api/admin/users/${u.username}/reset-password`, {});
          setPasswordResult({ open: true, username: result?.username || u.username, password: result?.password || "" });
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to reset password");
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      email: "",
      role: "OFFICE",
      officeName: "",
      service: ""
    });
  };

  const startEdit = (u: any) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      password: "",
      email: u.email || "",
      role: u.role,
      officeName: u.officeName || "",
      service: u.service || ""
    });
  };

  const normalizedUsers = users.map((u) => ({ ...u, disabled: Boolean(u.disabled) }));

  const filteredUsers = normalizedUsers.filter((u) => {
    if (roleFilter !== "ALL" && String(u.role || "") !== roleFilter) return false;
    if (statusFilter === "active" && u.disabled) return false;
    if (statusFilter === "disabled" && !u.disabled) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.username || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q) ||
      String(u.officeName || "").toLowerCase().includes(q) ||
      String(u.service || "").toLowerCase().includes(q) ||
      String(u.role || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button
          onClick={() => navigate("/admin")}
          title="Go back to SuperAdmin Dashboard"
          style={{
            padding: "10px 16px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0 }}>User Management</h1>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            title={realtimeStatus === "connected" ? "Realtime connected" : "Realtime disconnected"}
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
                await fetchUsers();
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
            title="Refresh users"
            disabled={refreshing}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px",
          color: "#dc2626",
          marginBottom: "16px",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Filter users..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            minWidth: "200px",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: "var(--card)",
            color: "inherit"
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          style={{
            minWidth: "160px",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: "var(--card)",
            color: "inherit"
          }}
          title="Role filter"
        >
          <option value="ALL">All roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="OFFICE">OFFICE</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{
            minWidth: "160px",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: "var(--card)",
            color: "inherit"
          }}
          title="Status filter"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
        </select>
        <button
          onClick={() => {
            resetForm();
            setEditingUser(null);
            setShowAddModal(true);
          }}
          style={{
            padding: "8px 16px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", color: "var(--muted)", fontSize: 13 }}>
        <div style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 999, background: "var(--card)" }}>
          Total: <span style={{ fontWeight: 700, color: "inherit" }}>{normalizedUsers.length}</span>
        </div>
        <div style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 999, background: "var(--card)" }}>
          Admin: <span style={{ fontWeight: 700 }}>{normalizedUsers.filter((u) => String(u.role) === "ADMIN").length}</span>
        </div>
        <div style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 999, background: "var(--card)" }}>
          Office: <span style={{ fontWeight: 700 }}>{normalizedUsers.filter((u) => String(u.role) === "OFFICE").length}</span>
        </div>
        <div style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 999, background: "var(--card)" }}>
          Disabled: <span style={{ fontWeight: 700 }}>{normalizedUsers.filter((u) => u.disabled).length}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading users...
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px"
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Username</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Email</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Role</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Office</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Service</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.username} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", fontWeight: "500" }}>{u.username}</td>
                    <td style={{ padding: "12px" }}>{u.email || "-"}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 8px",
                        background: u.role.includes("ADMIN") ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                        color: u.role.includes("ADMIN") ? "#dc2626" : "#3b82f6",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500"
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>{u.officeName || "-"}</td>
                    <td style={{ padding: "12px" }}>{u.service || "-"}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 8px",
                        background: u.disabled ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.12)",
                        color: u.disabled ? "#dc2626" : "#16a34a",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "700"
                      }}>
                        {u.disabled ? "DISABLED" : "ACTIVE"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => startEdit(u)}
                        style={{
                          padding: "8px 14px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "8px",
                          fontWeight: "500",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                        title="Edit user"
                      >
                        <Edit2 size={16} /> Edit
                      </button>
                      <button
                        onClick={() => handleResetPassword(u)}
                        style={{
                          padding: "8px 14px",
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "8px",
                          fontWeight: "500",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "inherit"
                        }}
                        title="Reset password"
                      >
                        <KeyRound size={16} /> Reset
                      </button>
                      <button
                        onClick={() => handleToggleDisabled(u)}
                        style={{
                          padding: "8px 14px",
                          background: u.disabled ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.1)",
                          border: `1px solid ${u.disabled ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "8px",
                          fontWeight: "500",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          color: u.disabled ? "#16a34a" : "#dc2626"
                        }}
                        title={u.disabled ? "Enable user" : "Disable user"}
                      >
                        {u.disabled ? <CheckCircle2 size={16} /> : <Ban size={16} />} {u.disabled ? "Enable" : "Disable"}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.username)}
                        style={{
                          padding: "8px 14px",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "4px",
                          cursor: "pointer",
                          color: "#dc2626",
                          fontWeight: "500",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                        title="Delete user"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showAddModal || !!editingUser}
        onClose={() => {
          setShowAddModal(false);
          setEditingUser(null);
          resetForm();
        }}
      >
        <div style={{ padding: "20px", minWidth: "400px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
            {editingUser ? "Edit User" : "Add New User"}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!editingUser}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit",
                  opacity: editingUser ? 0.6 : 1
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@domain.com"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Password {editingUser && "(leave empty to keep current)"}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit"
                }}
              >
                <option value="OFFICE">OFFICE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Office Name (Optional)
              </label>
              <input
                type="text"
                value={formData.officeName}
                onChange={(e) => setFormData({ ...formData, officeName: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Service (Optional)
              </label>
              <input
                type="text"
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                onClick={editingUser ? handleUpdateUser : handleAddUser}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                {editingUser ? "Update User" : "Add User"}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "var(--secondary-bg)",
                  color: "var(--secondary-color)",
                  border: "1px solid var(--secondary-border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmState.open}
        onClose={() => setConfirmState({ open: false, title: "", message: "", onConfirm: null })}
        onConfirm={() => confirmState.onConfirm?.()}
        title={confirmState.title}
        message={confirmState.message}
      />

      <Modal
        open={passwordResult.open}
        onClose={() => setPasswordResult({ open: false, username: "", password: "" })}
      >
        <div style={{ padding: 18, minWidth: 420 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>Password reset</h2>
          <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
            New password for <span style={{ fontWeight: 700 }}>{passwordResult.username}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              value={passwordResult.password}
              readOnly
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "inherit" }}
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(passwordResult.password);
                } catch {}
              }}
              style={{
                padding: "10px 12px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                cursor: "pointer",
                color: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700
              }}
              title="Copy password"
            >
              <Copy size={16} />
              Copy
            </button>
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setPasswordResult({ open: false, username: "", password: "" })}
              style={{
                padding: "10px 14px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
