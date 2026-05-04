import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api, subscribeAdminEvents } from "../api";
import { Plus, Trash2, Calendar, Activity, RefreshCw, Pencil } from "lucide-react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";

export default function AdminSettings() {
  const user = getUserFromToken();
  const navigate = useNavigate();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ month: 1, day: 1, name: "" });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<{ month: number; day: number } | null>(null);
  const [editForm, setEditForm] = useState({ month: 1, day: 1, name: "" });
  const [filter, setFilter] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "error">("connected");
  const [refreshing, setRefreshing] = useState(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string; onConfirm: (() => void) | null }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null
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
    fetchHolidays();

    const unsub = subscribeAdminEvents(
      (payload) => {
        const type = payload?.type;
        if (typeof type !== "string") return;
        if (type.startsWith("holiday.")) {
          fetchHolidays().catch(() => {});
        }
      },
      (s) => setRealtimeStatus(s)
    );
    return () => unsub();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const data = await api.get("/api/admin/holidays");
      setHolidays(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!formData.month || !formData.day) {
      setError("Month and day are required");
      return;
    }
    try {
      await api.post("/api/admin/holidays", formData);
      fetchHolidays();
      setShowAddModal(false);
      resetForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create holiday");
    }
  };

  const openEditHoliday = (holiday: any) => {
    setEditTarget({ month: Number(holiday.month), day: Number(holiday.day) });
    setEditForm({ month: Number(holiday.month), day: Number(holiday.day), name: String(holiday.name || "") });
    setShowEditModal(true);
    setError(null);
  };

  const handleUpdateHoliday = async () => {
    if (!editTarget) return;
    if (!editForm.month || !editForm.day) {
      setError("Month and day are required");
      return;
    }
    try {
      await api.put(`/api/admin/holidays/${editTarget.month}/${editTarget.day}`, editForm);
      await fetchHolidays();
      setShowEditModal(false);
      setEditTarget(null);
      setError(null);
    } catch (err: any) {
      const status = typeof err?.status === "number" ? err.status : null;
      if (status === 409) {
        setError("That date already exists as a holiday. Please choose a different date.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to update holiday");
      }
    }
  };

  const handleDeleteHoliday = async (month: number, day: number) => {
    const holiday = holidays.find(h => h.month === month && h.day === day);
    const holidayName = holiday?.name || `${month}/${day}`;
    setConfirmState({
      open: true,
      title: "Delete holiday",
      message: `Delete holiday "${holidayName}"?`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/holidays/${month}/${day}`);
          await fetchHolidays();
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to delete holiday");
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({ month: 1, day: 1, name: "" });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredHolidays = holidays.filter(h =>
    (h.name && h.name.toLowerCase().includes(filter.toLowerCase())) ||
    `${h.month}/${h.day}`.includes(filter)
  );

  const sortedHolidays = [...filteredHolidays].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button
          onClick={() => navigate("/admin")}
          title="Go back to SuperAdmin Dashboard"
          style={{
            padding: "10px 16px",
            background: "#f59e0b",
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
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0 }}>System Settings</h1>
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
                await fetchHolidays();
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
            title="Refresh settings"
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

      {/* Holidays Section */}
      <div style={{
        padding: "20px",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        background: "var(--card)",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <Calendar size={24} style={{ color: "#f59e0b" }} />
          <h2 style={{ fontSize: "20px", fontWeight: "600", margin: 0 }}>
            Holidays Management
          </h2>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Filter holidays..."
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
              setShowAddModal(true);
            }}
            style={{
              padding: "8px 16px",
              background: "#f59e0b",
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
            <Plus size={18} /> Add Holiday
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading holidays...
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
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Holiday Name</th>
                  <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                      No holidays configured
                    </td>
                  </tr>
                ) : (
                  sortedHolidays.map((holiday, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px", fontWeight: "500" }}>
                        {monthNames[holiday.month - 1]} {holiday.day}, {new Date(2024, holiday.month - 1, holiday.day).getFullYear()}
                      </td>
                      <td style={{ padding: "12px" }}>{holiday.name || "-"}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                          <button
                            onClick={() => openEditHoliday(holiday)}
                            style={{
                              padding: "6px 10px",
                              background: "rgba(59, 130, 246, 0.1)",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                              borderRadius: "4px",
                              cursor: "pointer",
                              color: "#2563eb"
                            }}
                            title="Edit holiday"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(holiday.month, holiday.day)}
                            style={{
                              padding: "6px 10px",
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "4px",
                              cursor: "pointer",
                              color: "#dc2626"
                            }}
                            title="Delete holiday"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Info Card */}
      <div style={{
        padding: "20px",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        background: "rgba(59, 130, 246, 0.05)"
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
          📊 System Information
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
          Total Holidays Configured: <strong>{holidays.length}</strong>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Use the holidays list to manage dates that should not have scheduled events.
        </p>
      </div>

      {/* Add Holiday Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <div style={{ padding: "20px", minWidth: "400px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
            Add New Holiday
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                  Month
                </label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    background: "var(--card)",
                    color: "inherit"
                  }}
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                  Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: Number(e.target.value) })}
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Holiday Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., New Year's Day"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                onClick={handleAddHoliday}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                Add Holiday
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
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

      {/* Edit Holiday Modal */}
      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditTarget(null);
        }}
      >
        <div style={{ padding: "20px", minWidth: "400px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
            Edit Holiday
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                  Month
                </label>
                <select
                  value={editForm.month}
                  onChange={(e) => setEditForm({ ...editForm, month: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    background: "var(--card)",
                    color: "inherit"
                  }}
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                  Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editForm.day}
                  onChange={(e) => setEditForm({ ...editForm, day: Number(e.target.value) })}
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Holiday Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., New Year's Day"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                onClick={handleUpdateHoliday}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditTarget(null);
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

      <ConfirmModal
        open={confirmState.open}
        onClose={() => setConfirmState({ open: false, title: "", message: "", onConfirm: null })}
        onConfirm={() => confirmState.onConfirm?.()}
        title={confirmState.title}
        message={confirmState.message}
      />
    </div>
  );
}
