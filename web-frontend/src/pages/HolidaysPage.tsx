import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import { api } from "../api";

type Holiday = { month: number; day: number; name?: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function monthLabel(m: number) {
  if (!m || m < 1 || m > 12) return "Unknown";
  return MONTHS[m - 1];
}

function normalizeText(v: any) {
  return String(v ?? "").trim();
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [createForm, setCreateForm] = useState({ month: "1", day: "1", name: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editForm, setEditForm] = useState({ month: "1", day: "1", name: "" });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get("/api/admin/holidays");
      setHolidays(Array.isArray(d) ? d : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load holidays");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createHoliday() {
    setError(null);
    const name = normalizeText(createForm.name);
    const month = Number(createForm.month);
    const day = Number(createForm.day);
    if (!name) return setError("Holiday name is required");
    if (!Number.isInteger(month) || month < 1 || month > 12) return setError("Invalid month");
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("Invalid day");
    try {
      await api.post("/api/admin/holidays", { month, day, name });
      setCreateForm({ month: "1", day: "1", name: "" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to create holiday");
    }
  }

  function openEdit(h: Holiday) {
    setError(null);
    const n = normalizeText(h?.name);
    setEditOriginalName(n);
    setEditForm({
      month: String(Number(h?.month) || 1),
      day: String(Number(h?.day) || 1),
      name: n
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    setError(null);
    const name = normalizeText(editForm.name);
    const month = Number(editForm.month);
    const day = Number(editForm.day);
    if (!name) return setError("Holiday name is required");
    if (!Number.isInteger(month) || month < 1 || month > 12) return setError("Invalid month");
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("Invalid day");
    try {
      await api.put(`/api/admin/holidays/${encodeURIComponent(editOriginalName)}`, { month, day, name });
      setEditOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update holiday");
    }
  }

  async function deleteHoliday(name: string) {
    setError(null);
    try {
      await api.delete(`/api/admin/holidays/${encodeURIComponent(name)}`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete holiday");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...holidays];
    copy.sort((a, b) => {
      const am = Number(a?.month) || 0;
      const bm = Number(b?.month) || 0;
      if (am !== bm) return am - bm;
      const ad = Number(a?.day) || 0;
      const bd = Number(b?.day) || 0;
      if (ad !== bd) return ad - bd;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
    return copy;
  }, [holidays]);

  const filtered = useMemo(() => {
    const m = monthFilter ? Number(monthFilter) : 0;
    if (!m) return sorted;
    return sorted.filter((h) => Number(h?.month) === m);
  }, [sorted, monthFilter]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Holidays</h1>
      <p style={{ marginTop: 6, marginBottom: 16, color: "var(--muted)" }}>Reference list used for calendar highlighting.</p>

      {error && (
        <div style={{ padding: 12, border: "1px solid var(--error-border)", background: "var(--error-bg)", color: "var(--error-color)", borderRadius: 10, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Add Holiday</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Month</div>
            <select value={createForm.month} onChange={(e) => setCreateForm((s) => ({ ...s, month: e.target.value }))}>
              {MONTHS.map((name, idx) => (
                <option key={name} value={String(idx + 1)}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Day</div>
            <select value={createForm.day} onChange={(e) => setCreateForm((s) => ({ ...s, day: e.target.value }))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Holiday Name <span style={{ color: "var(--error-color)" }}>*</span>
            </div>
            <input placeholder="e.g., New Year's Day" value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={createHoliday} style={{ padding: "10px 14px", fontWeight: 700, borderRadius: 10, minWidth: 140 }}>
            Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ minWidth: 240 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Month</label>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">All</option>
            {MONTHS.map((name, idx) => (
              <option key={name} value={String(idx + 1)}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>
          {loading ? "Loading..." : `${filtered.length} holiday${filtered.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", background: "var(--card)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.04)" }}>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Date</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border)" }}>Holiday</th>
                <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => (
                <tr key={`${h.month}-${h.day}-${h.name || "x"}-${i}`}>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    {monthLabel(Number(h.month))} {Number(h.day)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>{h.name || ""}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(h)} style={{ padding: "6px 10px", borderRadius: 10, marginRight: 8 }}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteName(normalizeText(h.name));
                        setConfirmDeleteOpen(true);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: "var(--error-bg)",
                        border: "1px solid var(--error-border)",
                        color: "var(--error-color)"
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "var(--muted)" }}>
                    No holidays found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} style={{ width: 640, maxWidth: "calc(100vw - 32px)" }}>
        <div style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 16 }}>Edit Holiday</h3>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{editOriginalName}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Month</div>
              <select value={editForm.month} onChange={(e) => setEditForm((s) => ({ ...s, month: e.target.value }))}>
                {MONTHS.map((name, idx) => (
                  <option key={name} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Day</div>
              <select value={editForm.day} onChange={(e) => setEditForm((s) => ({ ...s, day: e.target.value }))}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Holiday Name <span style={{ color: "var(--error-color)" }}>*</span>
              </div>
              <input value={editForm.name} placeholder="Holiday name" onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditOpen(false)} style={{ padding: "8px 12px", borderRadius: 10 }}>
              Cancel
            </button>
            <button onClick={saveEdit} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 700, minWidth: 120 }}>
              Save
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => deleteHoliday(deleteName)}
        title="Delete holiday?"
        message={`This will remove "${deleteName}".`}
      />
    </div>
  );
}
