import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api } from "../api";
import { Plus, Edit2, Trash2, ChevronLeft } from "lucide-react";
import Modal from "../components/Modal";

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
    role: "OFFICE",
    officeName: "",
    service: ""
  });
  const [filter, setFilter] = useState("");

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
    try {
      await api.post("/api/admin/users", formData);
      fetchUsers();
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
      await api.put(`/api/admin/users/${editingUser.username}`, updateData);
      fetchUsers();
      setEditingUser(null);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        await api.delete(`/api/admin/users/${username}`);
        fetchUsers();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete user");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
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
      role: u.role,
      officeName: u.officeName || "",
      service: u.service || ""
    });
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(filter.toLowerCase()) ||
    (u.officeName && u.officeName.toLowerCase().includes(filter.toLowerCase())) ||
    (u.role && u.role.toLowerCase().includes(filter.toLowerCase()))
  );

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

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
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
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Role</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Office</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Service</th>
                <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.username} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", fontWeight: "500" }}>{u.username}</td>
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
                    <td style={{ padding: "12px", textAlign: "center" }}>
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
                  background: "var(--card)",
                  border: "1px solid var(--border)",
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
    </div>
  );
}
