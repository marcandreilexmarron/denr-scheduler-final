import React, { useEffect, useMemo, useState } from "react";
import { getToken, getUserFromToken } from "../auth";
import Modal from "../components/Modal";
import AddEventModal from "../components/AddEventModal";

type CalendarDay = { day: number | string; isToday: boolean; holiday: { day: number; month: number; name: string } | null };
type CalendarData = {
  yearMonth: string;
  previousMonth: number;
  previousYear: number;
  nextMonth: number;
  nextYear: number;
  calendarDays: CalendarDay[];
  today: number;
  holidays: Array<{ month: number; day: number; name: string }>;
};

const CATEGORY_OPTIONS = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
const CATEGORY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  workshop: { bg: "#eef7ff", fg: "#0b5ed7", border: "#b6d4fe" },
  meeting: { bg: "#e8f5e9", fg: "#1b5e20", border: "#c8e6c9" },
  training: { bg: "#fff8e1", fg: "#8d6e63", border: "#ffecb3" },
  conference: { bg: "#f3e5f5", fg: "#4a148c", border: "#e1bee7" },
  travel: { bg: "#e0f7fa", fg: "#006064", border: "#b2ebf2" },
  activity: { bg: "#fce4ec", fg: "#880e4f", border: "#f8bbd0" },
  "others - specified": { bg: "#f5f5f5", fg: "#424242", border: "#e0e0e0" }
};

export default function Calendar(props?: {
  officeFilter?: string;
  onOfficeFilterChange?: (v: string) => void;
  categoryFilter?: string;
  onCategoryFilterChange?: (v: string) => void;
  hideMonthList?: boolean;
  onViewChange?: (year: number, month: number) => void;
  showScopeToggle?: boolean;
  categoriesAsChips?: boolean;
  showOfficeSelector?: boolean;
  onDateSelect?: (date: string, events: any[]) => void;
  disableDateModal?: boolean;
  selectedDate?: string;
  allowCreate?: boolean;
  canEditEvent?: (e: any, user?: any) => boolean;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<CalendarData | null>(null);
  const [eventsAll, setEventsAll] = useState<any[]>([]);
  const [eventsOffice, setEventsOffice] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ date: string; events: any[] } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [availableOffices, setAvailableOffices] = useState<string[]>([]);
  const [officesData, setOfficesData] = useState<{ topLevelOffices: Array<{ name: string }>; services: Array<{ name: string; offices: Array<{ name: string }> }> } | null>(null);
  const user = getUserFromToken();
  const canEdit = !!(user?.role?.endsWith?.("ADMIN") || user?.role?.endsWith?.("OFFICE"));
  const allowCreate = props?.allowCreate !== undefined ? !!props.allowCreate : canEdit;
  function canEditEvent(e: any) {
    if (typeof props?.canEditEvent === "function") return !!props!.canEditEvent!(e, user);
    return canEdit;
  }
  const [creating, setCreating] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [officeFilterState, setOfficeFilterState] = useState<string>("");
  const [categoryFilterState, setCategoryFilterState] = useState<string>("");
  const officeFilter = props?.officeFilter !== undefined ? props.officeFilter! : officeFilterState;
  const setOfficeFilter = props?.onOfficeFilterChange ?? setOfficeFilterState;
  const categoryFilter = props?.categoryFilter !== undefined ? props.categoryFilter! : categoryFilterState;
  const setCategoryFilter = props?.onCategoryFilterChange ?? setCategoryFilterState;
  const categories = CATEGORY_OPTIONS;
  const showScopeToggle = props?.showScopeToggle !== undefined ? !!props.showScopeToggle : true;
  const categoriesAsChips = !!props?.categoriesAsChips;
  const showOfficeSelector = props?.showOfficeSelector !== undefined ? !!props.showOfficeSelector : true;

  useEffect(() => {
    fetch(`/api/calendar?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then((d) => setData(d));
    if (props?.onViewChange) props.onViewChange(year, month);
  }, [month, year]);

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then((d) => setEventsAll(d));
    const t = getToken();
    if (t) {
      fetch("/api/office/events", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => setEventsOffice(d));
    }
    fetch("/api/offices-data")
      .then((r) => r.json())
      .then((d) => {
        setOfficesData(d);
        const names = [
          ...d.topLevelOffices.map((o: any) => o.name),
          ...d.services.flatMap((s: any) => s.offices.map((o: any) => o.name))
        ];
        setAvailableOffices(names);
      });
  }, []);

  useEffect(() => {
    function refresh() {
      fetch("/api/events").then((r) => r.json()).then((d) => setEventsAll(d));
      const t = getToken();
      if (t) {
        fetch("/api/office/events", { headers: { Authorization: `Bearer ${t}` } })
          .then((r) => r.json())
          .then((d) => setEventsOffice(d));
      }
    }
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, []);

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  function parseDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayInRange(day: Date, start: Date, end: Date) {
    const t = day.getTime();
    return t >= start.getTime() && t <= end.getTime();
  }
  function eventMatchesOffice(e: any, officeName: string) {
    if (!officeName) return true;
    if (e.office && e.office === officeName) return true;
    if (Array.isArray(e.participants) && e.participants.includes(officeName)) return true;
    return false;
  }
  function normalizeCategory(s: string) {
    return String(s || "").trim().toLowerCase();
  }
  function categoryStyle(cat?: string) {
    const key = normalizeCategory(cat || "");
    const c = CATEGORY_COLORS[key] || { bg: "#eeeeee", fg: "#333333", border: "#dddddd" };
    return { background: c.bg, color: c.fg, borderColor: c.border };
  }
  function eventMatchesCategory(e: any, cat: string) {
    if (!cat) return true;
    return normalizeCategory(e.category || "") === normalizeCategory(cat);
  }
  function formatFullDate(s: string) {
    try {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return s;
    }
  }
  function formatTime(t?: string) {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }

  const eventsIndex = useMemo(() => {
    const map = new Map<string, any[]>();
    const src = eventsAll.filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter));
    for (const e of src) {
      if (e.dateType === "range" && e.startDate && e.endDate) {
        const start = parseDate(e.startDate);
        const end = parseDate(e.endDate);
        const cursor = new Date(start);
        while (cursor <= end) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(e);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else if (e.date) {
        const d = parseDate(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [eventsAll, officeFilter, categoryFilter]);

  const officeEventsIndex = useMemo(() => {
    const map = new Map<string, any[]>();
    const src = eventsOffice.filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter));
    for (const e of src) {
      if (e.dateType === "range" && e.startDate && e.endDate) {
        const start = parseDate(e.startDate);
        const end = parseDate(e.endDate);
        const cursor = new Date(start);
        while (cursor <= end) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(e);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else if (e.date) {
        const d = parseDate(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [eventsOffice, officeFilter, categoryFilter]);

  const [scope, setScope] = useState<"all" | "office">("all");
  const idx = scope === "all" ? eventsIndex : officeEventsIndex;
  const listSource = scope === "all" ? eventsAll : eventsOffice;

  function reloadEvents() {
    fetch("/api/events").then((r) => r.json()).then((d) => setEventsAll(d));
    const t = getToken();
    if (t) {
      fetch("/api/office/events", { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => setEventsOffice(d));
    }
  }
  function deleteEvent(id: string) {
    const t = getToken();
    if (!t) return;
    fetch(`/api/events/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
      .then((r) => {
        if (r.status === 204) {
          reloadEvents();
          if (selected) {
            const list = (idx.get(selected.date) ?? []).filter((e) => e.id !== id);
            setSelected({ date: selected.date, events: list });
          }
        }
      });
  }
  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const t = getToken();
    if (!t || !editing) return;
    fetch(`/api/events/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(editing)
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        reloadEvents();
        if (selected) {
          const list = idx.get(selected.date) ?? [];
          setSelected({ date: selected.date, events: list });
        }
      });
  }

  function prev() {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    setMonth(m);
    setYear(y);
  }
  function next() {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    setMonth(m);
    setYear(y);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ textAlign: "center", margin: "0 0 8px 0" }}>Calendar</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          marginTop: 8
        }}
      >
        <button
          onClick={prev}
          style={{
            justifySelf: "start",
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "4px 10px",
            lineHeight: "20px",
            cursor: "pointer"
          }}
          aria-label="Previous month"
        >
          ‹ Prev
        </button>
        <div style={{ textAlign: "center", fontWeight: 600 }}>
          {data?.yearMonth ?? ""}
        </div>
        <button
          onClick={next}
          style={{
            justifySelf: "end",
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "4px 10px",
            lineHeight: "20px",
            cursor: "pointer"
          }}
          aria-label="Next month"
        >
          Next ›
        </button>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {showScopeToggle && (
          <>
            <label style={{ marginRight: 12 }}>
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />{" "}
              All events
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                value="office"
                checked={scope === "office"}
                onChange={() => setScope("office")}
              />{" "}
              My office
            </label>
          </>
        )}
        {showOfficeSelector && (
          <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
            <option value="">All offices</option>
            {availableOffices.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        {!categoriesAsChips && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
      {categoriesAsChips && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            flexWrap: "nowrap",
            overflowX: "auto",
            scrollbarGutter: "stable",
            alignItems: "stretch",
            width: "100%"
          }}
        >
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className="chip"
            style={{
              background: categoryFilter ? "transparent" : "#e5e7eb",
              color: categoryFilter ? "inherit" : "var(--text)",
              border: `1px solid ${categoryFilter ? "var(--border)" : "#cbd5e1"}`,
              flex: "1 1 0",
              minWidth: 80
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>All</span>
          </button>
          {categories.map((c) => {
            const active = normalizeCategory(c) === normalizeCategory(categoryFilter);
            const styles = categoryStyle(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className="chip"
                style={{
                  background: active ? styles.background : "transparent",
                  color: active ? styles.color : "inherit",
                  border: `1px solid ${active ? styles.borderColor : "var(--border)"}`,
                  flex: "1 1 0",
                  minWidth: 80
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: styles.background,
                    border: `1px solid ${styles.borderColor}`
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{c}</span>
              </button>
            );
          })}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginTop: 12
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ fontWeight: "bold", textAlign: "center", height: 28, lineHeight: "28px" }}>
            {d}
          </div>
        ))}
        {data?.calendarDays.map((d, i) => {
          const key = typeof d.day === "number" ? `${year}-${String(month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "";
          const isSelected =
            typeof d.day === "number" &&
            ((props?.selectedDate && key === props.selectedDate) || (!props?.selectedDate && selected?.date === key));
          const baseBg = typeof d.day === "number" && d.isToday ? "#ffeeba" : d.holiday ? "#f8d7da" : "white";
          return (
            <div
              key={i}
              aria-selected={isSelected ? true : undefined}
              style={{
                border: isSelected ? `2px solid var(--primary)` : "1px solid #ddd",
                height: 110,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: isSelected ? "#eff6ff" : baseBg,
                cursor: typeof d.day === "number" ? "pointer" : "default",
                transition: "border-color 120ms ease, background 120ms ease"
              }}
              onClick={() => {
                if (typeof d.day !== "number") return;
                const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
                const list = idx.get(dayKey) ?? [];
                if (props?.onDateSelect) props.onDateSelect(dayKey, list);
                if (!props?.disableDateModal) setSelected({ date: dayKey, events: list });
              }}
            >
              <div style={{ fontWeight: 600, lineHeight: "16px", marginBottom: 2 }}>{d.day}</div>
              {d.holiday && <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.holiday.name}</div>}
              {typeof d.day === "number" && (
                <div style={{ marginTop: 6, overflow: "hidden" }}>
                  {(idx.get(`${year}-${String(month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`) ?? [])
                    .slice(0, 2)
                    .map((e, j) => {
                      const s = categoryStyle(e.category);
                      return (
                        <div
                          key={j}
                          style={{
                            fontSize: 12,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            lineHeight: "16px",
                            background: s.background,
                            color: s.color,
                            border: `1px solid ${s.borderColor}`,
                            borderRadius: 4,
                            padding: "0 6px"
                          }}
                        >
                          <span style={{ flex: 1 }}>{e.title}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!props?.disableDateModal && (
        <Modal open={!!selected} onClose={() => { setSelected(null); setEditing(null); }}>
          {selected && (
          <div>
            <h3>Events on {selected.date}</h3>
            {allowCreate && (
              <div style={{ marginBottom: 8 }}>
                <button onClick={() => setAddOpen(true)}>New Event</button>
              </div>
            )}
            <AddEventModal
              open={addOpen}
              onClose={() => setAddOpen(false)}
              defaultDate={selected.date}
              categories={categories}
              availableOffices={availableOffices}
              officesData={officesData ?? undefined}
              onSubmit={(payload) => {
                const t = getToken();
                if (!t) return;
                fetch("/api/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
                  body: JSON.stringify(payload)
                })
                  .then((r) => r.json())
                  .then(() => {
                    setAddOpen(false);
                    reloadEvents();
                    const list = idx.get(selected.date) ?? [];
                    setSelected({ date: selected.date, events: list });
                  });
              }}
            />
            {selected.events.length === 0 ? (
              <div>No events</div>
            ) : (
              <ul className="list">
                {selected.events.map((e, i) => {
                  const isEditing = editing && editing.id === e.id;
                  return (
                    <li
                      key={i}
                      className="list-item"
                      style={{
                        background: categoryStyle(e.category).background,
                        color: categoryStyle(e.category).color,
                        borderLeft: `4px solid ${categoryStyle(e.category).borderColor}`
                      }}
                    >
                      {!isEditing ? (
                        <>
                          {e.startTime}-{e.endTime} {e.title} {e.location ? `@ ${e.location}` : ""}
                          {e.office && <span className="badge">{e.office}</span>}
                          {e.category && <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>}
                          {e.category === "others - specified" && e.categoryDetail && <span className="badge">{e.categoryDetail}</span>}
                          {Array.isArray(e.participants) && e.participants.length > 0 && (
                            <span className="badge">{e.participants.length} participants</span>
                          )}
                           {canEditEvent(e) && (
                            <>
                              {" "}
                              <button onClick={() => setEditing({ ...e })}>Edit</button>{" "}
                              <button onClick={() => deleteEvent(e.id)}>Delete</button>
                            </>
                          )}
                        </>
                      ) : (
                        <form onSubmit={saveEdit} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, alignItems: "center", width: "100%" }}>
                          <input value={editing.title} onChange={(ev) => setEditing({ ...editing, title: ev.target.value })} />
                          <input type="time" value={editing.startTime} onChange={(ev) => setEditing({ ...editing, startTime: ev.target.value })} />
                          <input type="time" value={editing.endTime} onChange={(ev) => setEditing({ ...editing, endTime: ev.target.value })} />
                          <input placeholder="Location" value={editing.location || ""} onChange={(ev) => setEditing({ ...editing, location: ev.target.value })} />
                          <select value={editing.category || ""} onChange={(ev) => setEditing({ ...editing, category: ev.target.value })}>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          {normalizeCategory(editing.category || "") === "others - specified" && (
                            <input placeholder="Specify category" value={editing.categoryDetail || ""} onChange={(ev) => setEditing({ ...editing, categoryDetail: ev.target.value })} />
                          )}
                          <select value={editing.office ?? ""} onChange={(ev) => setEditing({ ...editing, office: ev.target.value || null })}>
                            <option value="">No specific office</option>
                            {availableOffices.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                          <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 8, border: "1px solid var(--border)", borderRadius: 6, padding: 6 }}>
                            {availableOffices.map((o) => {
                              const checked = Array.isArray(editing.participants) && editing.participants.includes(o);
                              return (
                                <label key={o} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(ev) => {
                                      if (ev.target.checked) {
                                        const next = Array.isArray(editing.participants) ? [...editing.participants, o] : [o];
                                        setEditing({ ...editing, participants: next });
                                      } else {
                                        const next = (editing.participants || []).filter((x: string) => x !== o);
                                        setEditing({ ...editing, participants: next });
                                      }
                                    }}
                                  />
                                  <span>{o}</span>
                                </label>
                              );
                            })}
                          </div>
                          <button type="submit">Save</button>
                          <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          )}
        </Modal>
      )}
      {!props?.hideMonthList && (
        <div style={{ marginTop: 16 }}>
          <h3>Events This Month</h3>
          <ul className="list">
            {(() => {
              const filtered = listSource
                .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
                .filter((e) => {
                  if (e.dateType === "range" && e.startDate && e.endDate) {
                    const start = parseDate(e.startDate);
                    const end = parseDate(e.endDate);
                    return (start.getFullYear() === year && start.getMonth() + 1 === month) ||
                           (end.getFullYear() === year && end.getMonth() + 1 === month) ||
                           (start.getFullYear() <= year && end.getFullYear() >= year &&
                            start.getMonth() + 1 <= month && end.getMonth() + 1 >= month);
                  } else if (e.date) {
                    const d = parseDate(e.date);
                    return d.getFullYear() === year && d.getMonth() + 1 === month;
                  }
                  return false;
                });
              if (filtered.length === 0) {
                return <li className="list-item">No events are scheduled</li>;
              }
              return filtered.map((e, i) => (
                <li key={e.id ?? i} className="list-item">
                  <div>
                    <strong>{e.title}</strong>
                    {e.category && <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>}
                  </div>
                </li>
              ));
            })()}
          </ul>
        </div>
      )}
    </div>
  );
}
