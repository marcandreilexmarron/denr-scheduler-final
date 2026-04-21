import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../auth";
import { api } from "../api";
import { Trash2, Edit2, ChevronLeft, Filter, RefreshCw } from "lucide-react";
import Modal from "../components/Modal";

export default function EventManagement() {
  const user = getUserFromToken();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [filter, setFilter] = useState("");
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if user is ADMIN
  if (!user || !String(user.role || "").includes("ADMIN")) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <p>Access denied. Only ADMIN users can access this page.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchEvents();
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvents = async () => {
    try {
      if (!isRefreshing) setLoading(true);
      const [activeData, archivedData] = await Promise.all([
        api.get("/api/admin/events"),
        api.get("/api/admin/events/archived")
      ]);
      setEvents(activeData || []);
      setArchivedEvents(archivedData || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEvents();
  };

  const handleDeleteEvent = async (id: string, isArchived: boolean) => {
    if (confirm("Are you sure you want to delete this event?")) {
      try {
        const endpoint = isArchived ? `/api/admin/events/archived/${id}` : `/api/admin/events/${id}`;
        await api.delete(endpoint);
        fetchEvents();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete event");
      }
    }
  };

  const handleEditEvent = async () => {
    if (!editingEvent?.id) return;
    try {
      await api.put(`/api/admin/events/${editingEvent.id}`, formData);
      fetchEvents();
      setEditingEvent(null);
      setFormData({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    }
  };

  const startEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      category: event.category,
      office: event.office
    });
  };

  const currentEvents = tab === "active" ? events : archivedEvents;
  const filteredEvents = currentEvents.filter(e =>
    e.title.toLowerCase().includes(filter.toLowerCase()) ||
    (e.office && e.office.toLowerCase().includes(filter.toLowerCase())) ||
    (e.description && e.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
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
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0 }}>Event Management</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh events list"
          style={{
            marginLeft: "auto",
            padding: "10px 16px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            opacity: isRefreshing ? 0.6 : 1
          }}
        >
          <RefreshCw size={16} style={{ animation: isRefreshing ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
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

      {/* Tabs and Filter */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid var(--border)" }}>
          <button
            onClick={() => setTab("active")}
            style={{
              padding: "8px 16px",
              background: tab === "active" ? "transparent" : "transparent",
              border: "none",
              borderBottom: tab === "active" ? "2px solid #3b82f6" : "none",
              color: tab === "active" ? "#3b82f6" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: tab === "active" ? "600" : "500",
              marginBottom: "-2px"
            }}
          >
            Active Events ({events.length})
          </button>
          <button
            onClick={() => setTab("archived")}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "none",
              borderBottom: tab === "archived" ? "2px solid #3b82f6" : "none",
              color: tab === "archived" ? "#3b82f6" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: tab === "archived" ? "600" : "500",
              marginBottom: "-2px"
            }}
          >
            Archived Events ({archivedEvents.length})
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <Filter size={18} style={{ color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search events..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              background: "var(--card)",
              color: "inherit",
              minWidth: "200px"
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          Loading events...
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
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Title</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Office</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Date</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Category</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>Created By</th>
                <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                    No events found
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", fontWeight: "500" }}>
                      <div style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {event.title}
                      </div>
                    </td>
                    <td style={{ padding: "12px" }}>{event.office || "-"}</td>
                    <td style={{ padding: "12px" }}>
                      {event.dateType === "range"
                        ? `${event.startDate} to ${event.endDate}`
                        : event.date || "-"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 8px",
                        background: "rgba(59, 130, 246, 0.1)",
                        color: "#3b82f6",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500"
                      }}>
                        {event.category || "General"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>{event.createdBy || "-"}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {tab === "active" && (
                        <button
                          onClick={() => startEdit(event)}
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
                          title="Edit event"
                        >
                          <Edit2 size={16} /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteEvent(event.id, tab === "archived")}
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
                        title="Delete event"
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

      {/* Edit Event Modal */}
      <Modal
        open={!!editingEvent}
        onClose={() => {
          setEditingEvent(null);
          setFormData({});
        }}
      >
        <div style={{ padding: "20px", minWidth: "500px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px" }}>
            Edit Event
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                Title
              </label>
              <input
                type="text"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "var(--card)",
                  color: "inherit",
                  minHeight: "100px",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "500" }}>
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category || ""}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
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
                  Office
                </label>
                <input
                  type="text"
                  value={formData.office || ""}
                  onChange={(e) => setFormData({ ...formData, office: e.target.value })}
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

            {editingEvent && (
              <div style={{
                padding: "12px",
                background: "rgba(59, 130, 246, 0.05)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--text-secondary)"
              }}>
                <strong>Created by:</strong> {editingEvent.createdBy || "-"} on {editingEvent.createdAt ? new Date(editingEvent.createdAt).toLocaleDateString() : "-"}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                onClick={handleEditEvent}
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
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setFormData({});
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
