import React, { useEffect, useMemo, useState } from "react";
import { getToken, getUserFromToken } from "../auth";
import Modal from "../components/Modal";
import AddEventModal from "../components/AddEventModal";
import ConfirmModal from "../components/ConfirmModal";
import { api } from "../api";

type CalendarDay = { day: number | string; isToday: boolean; holiday: { day: number; month: number; name: string } | null };
type CalendarData = {
  year: number;
  month: number;
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
  workshop: { bg: "var(--cat-workshop-bg)", fg: "var(--cat-workshop-fg)", border: "var(--cat-workshop-bd)" },
  meeting: { bg: "var(--cat-meeting-bg)", fg: "var(--cat-meeting-fg)", border: "var(--cat-meeting-bd)" },
  training: { bg: "var(--cat-training-bg)", fg: "var(--cat-training-fg)", border: "var(--cat-training-bd)" },
  conference: { bg: "var(--cat-conference-bg)", fg: "var(--cat-conference-fg)", border: "var(--cat-conference-bd)" },
  travel: { bg: "var(--cat-travel-bg)", fg: "var(--cat-travel-fg)", border: "var(--cat-travel-bd)" },
  activity: { bg: "var(--cat-activity-bg)", fg: "var(--cat-activity-fg)", border: "var(--cat-activity-bd)" },
  "others - specified": { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" }
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
  showCategorySelector?: boolean;
  onDateSelect?: (date: string, events: any[], info?: { shiftKey?: boolean }) => void;
  disableDateModal?: boolean;
  selectedDate?: string;
  blockPastDateClicks?: boolean;
  allowCreate?: boolean;
  canEditEvent?: (e: any, user?: any) => boolean;
  headerBelow?: React.ReactNode;
  showTitle?: boolean;
  refreshCounter?: number;
}) {
  function normalizeCategory(s: string) {
    return String(s || "").trim().toLowerCase();
  }
  function categoryStyle(cat?: string) {
    const key = normalizeCategory(cat || "");
    const c = CATEGORY_COLORS[key] || { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" };
    return { backgroundColor: c.bg, color: c.fg, borderColor: c.border };
  }
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<CalendarData | null>(null);
  const [eventsAll, setEventsAll] = useState<any[]>([]);
  const [eventsOffice, setEventsOffice] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ date: string; events: any[] } | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [availableOffices, setAvailableOffices] = useState<string[]>([]);
  const [officesData, setOfficesData] = useState<{ topLevelOffices: Array<{ name: string }>; services: Array<{ name: string; offices: Array<{ name: string }> }> } | null>(null);
  const [compact, setCompact] = useState<boolean>(() => {
    try {
      return window.innerWidth < 640;
    } catch {
      return false;
    }
  });
  const user = getUserFromToken();
  const canEdit = !!user?.role?.endsWith?.("OFFICE");
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
  const showCategorySelector = props?.showCategorySelector !== undefined ? !!props.showCategorySelector : true;

  useEffect(() => {
    api.get(`/api/calendar?month=${month}&year=${year}`)
      .then((d) => setData(d));
    if (props?.onViewChange) props.onViewChange(year, month);
  }, [month, year]);

  useEffect(() => {
    function onResize() {
      try {
        setCompact(window.innerWidth < 640);
      } catch {
        setCompact(false);
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    api.get("/api/events").then((d) => setEventsAll(d));
    const t = getToken();
    if (t) {
      api.get("/api/office/events").then((d) => setEventsOffice(d));
    }
    api.get("/api/offices-data")
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
      api.get("/api/events").then((d) => setEventsAll(d));
      const t = getToken();
      if (t) {
        api.get("/api/office/events").then((d) => setEventsOffice(d));
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
    const entry = Object.entries(map).find(([k]) => k.toLowerCase() === n.toLowerCase());
    return entry ? entry[1] : n;
  }
  function parseDate(s: string) {
    if (s.includes("T")) return new Date(s);
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
    const target = officeName.toLowerCase().trim();
    if (e.office && e.office.toLowerCase().trim() === target) return true;
    if (Array.isArray(e.participants)) {
      return e.participants.some((p: any) => String(p).toLowerCase().includes(target));
    }
    return false;
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

  const [scope, setScope] = useState<"all" | "office">("all");
  const listSource = scope === "all" ? eventsAll : eventsOffice;

  const idx = useMemo(() => {
    const map = new Map<string, any[]>();
    const src = listSource.filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter));
    
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
  }, [listSource, officeFilter, categoryFilter]);

  useEffect(() => {
    reloadEvents();
  }, [props?.refreshCounter]);

  function reloadEvents() {
    api.get("/api/events").then((d) => setEventsAll(d));
    const t = getToken();
    if (t) {
      api.get("/api/office/events").then((d) => setEventsOffice(d));
    }
  }
  function deleteEvent(id: string) {
    api.delete(`/api/events/${id}`)
      .then(() => {
        reloadEvents();
        if (selected) {
          const list = (idx.get(selected.date) ?? []).filter((e) => e.id !== id);
          setSelected({ date: selected.date, events: list });
        }
      });
  }
  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    api.put(`/api/events/${editing.id}`, editing)
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
    <div style={{ padding: 0 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--card)", padding: "24px 24px 8px 24px", borderBottom: "1px solid var(--border)" }}>
        {(props?.showTitle ?? true) && (
          <h1 style={{ textAlign: "center", margin: "0 0 8px 0" }}>Calendar</h1>
        )}
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
          <div style={{ textAlign: "center", fontWeight: 800, fontSize: 28, letterSpacing: 0.25 }}>
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
        {props?.headerBelow && (
          <div style={{ marginTop: 8 }}>
            {props.headerBelow}
          </div>
        )}
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
                All Events
              </label>
              <label>
                <input
                  type="radio"
                  name="scope"
                  value="office"
                  checked={scope === "office"}
                  onChange={() => setScope("office")}
                />{" "}
                My Office
              </label>
            </>
          )}
          {showOfficeSelector && (
            <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} style={{ background: "var(--card)", color: "var(--text)" }}>
              <option value="">All Offices</option>
              {availableOffices.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
          {!categoriesAsChips && showCategorySelector && (
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ background: "var(--card)", color: "var(--text)" }}>
              <option value="">All Categories</option>
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
                background: categoryFilter ? "transparent" : "var(--primary)",
                color: categoryFilter ? "inherit" : "white",
                border: `1px solid ${categoryFilter ? "var(--border)" : "var(--primary)"}`,
                flex: "1 1 0",
                minWidth: 80,
                borderRadius: 999,
                padding: "8px 12px",
                fontWeight: 600
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
                    background: styles.backgroundColor,
                    color: styles.color,
                    border: `1px solid ${styles.borderColor}`,
                    flex: "1 1 0",
                    minWidth: 80,
                    borderRadius: 999,
                    padding: "8px 12px",
                    boxShadow: active ? `0 0 0 2px ${styles.borderColor}` : "none",
                    filter: active ? "saturate(1.25) brightness(1.05)" : "saturate(1.1)",
                    opacity: active ? 1 : 0.9,
                    transition: "filter 120ms ease, box-shadow 120ms ease, opacity 120ms ease"
                  }}
                >
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
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginTop: 6,
          padding: "0 24px 24px 24px",
          userSelect: "none"
        }}
      >
        {data?.calendarDays.map((d, i) => {
          const dy = data.year;
          const dm = data.month;
          const key = typeof d.day === "number" ? `${dy}-${String(dm).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "";
          const isSelected =
            typeof d.day === "number" &&
            ((props?.selectedDate && key === props.selectedDate) || (!props?.selectedDate && selected?.date === key));
          const baseBg = d.holiday ? "var(--error-bg)" : "var(--card)";
          const isNumber = typeof d.day === "number";
          let isPast = false;
          if (isNumber) {
            const t = new Date();
            const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
            const cellDate = new Date(dy, dm - 1, d.day as number);
            isPast = cellDate.getTime() < todayStart.getTime();
          }
          return (
            <div
              key={i}
              aria-selected={isSelected ? true : undefined}
              onMouseDown={(ev) => {
                // Prevent browser text selection when shift-clicking for range
                if (ev.shiftKey) ev.preventDefault();
              }}
              style={{
                border: isSelected ? `2px solid var(--primary)` : (d.isToday ? "2px solid var(--blue-border)" : "1px solid var(--border)"),
                height: compact ? 84 : 110,
                padding: compact ? 4 : 6,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: isSelected ? "var(--blue-bg)" : baseBg,
                opacity: isNumber && isPast ? 0.5 : 1,
                cursor: isNumber ? (isPast && props?.blockPastDateClicks ? "default" : "pointer") : "default",
                transition: "border-color 120ms ease, background-color 120ms ease"
              }}
              onClick={(ev) => {
                if (typeof d.day !== "number") return;
                const t = new Date();
                const todayStart = new Date(t.getFullYear(), t.getMonth(), t.getDate());
                const cellDate = new Date(dy, dm - 1, d.day as number);
                const isPastClick = cellDate.getTime() < todayStart.getTime();
                if (props?.blockPastDateClicks && isPastClick) return;
                const dayKey = `${dy}-${String(dm).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
                const list = idx.get(dayKey) ?? [];
                if (props?.onDateSelect) props.onDateSelect(dayKey, list, { shiftKey: !!(ev as any).shiftKey });
                if (!props?.disableDateModal) {
                  if (selected && selected.date === dayKey) {
                    setSelected(null);
                  } else {
                    setSelected({ date: dayKey, events: list });
                  }
                }
              }}
            >
              <div style={{ fontWeight: 600, lineHeight: "16px", marginBottom: 2 }}>
                {typeof d.day === "number" && d.isToday ? (
                  <span
                    aria-current="date"
                    title="Today"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 22,
                      height: 22,
                      padding: "0 6px",
                      background: "var(--primary)",
                      color: "var(--primary-contrast)",
                      borderRadius: 999,
                      fontSize: 12,
                      lineHeight: "22px"
                    }}
                  >
                    {d.day}
                  </span>
                ) : (
                  <span>{d.day}</span>
                )}
              </div>
              {d.holiday && <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.holiday.name}</div>}
              {typeof d.day === "number" && (
                <div style={{ marginTop: 6, overflow: "hidden" }}>
                  {(idx.get(`${dy}-${String(dm).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`) ?? [])
                    .slice(0, 2)
                    .map((e, j) => {
                      const s = categoryStyle(e.category);
                      return (
                        <div
                          key={j}
                          style={{
                            fontSize: compact ? 11 : 12,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            lineHeight: compact ? "14px" : "16px",
                            backgroundColor: s.backgroundColor,
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
            <ConfirmModal
              open={!!deleting}
              onClose={() => setDeleting(null)}
              onConfirm={() => {
                if (deleting) deleteEvent(deleting.id);
                setDeleting(null);
              }}
              title="Confirm Delete"
              message={`Are you sure you want to delete "${deleting?.title}"? This action cannot be undone.`}
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
                        backgroundColor: categoryStyle(e.category).backgroundColor,
                        color: categoryStyle(e.category).color,
                        borderLeft: `4px solid ${categoryStyle(e.category).borderColor}`
                      }}
                    >
                      {!isEditing ? (
                        <>
                          {e.startTime}-{e.endTime} {e.title} {e.location ? `@ ${e.location}` : ""}
                          {e.office && <span className="badge">{compact ? abbreviateOffice(e.office) : e.office}</span>}
                          {e.category && <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>}
                          {e.category === "others - specified" && e.categoryDetail && <span className="badge">{e.categoryDetail}</span>}
                          {Array.isArray(e.participants) && e.participants.length > 0 && (
                            <span className="badge">{e.participants.length} participants</span>
                          )}
                           {canEditEvent(e) && (
                            <>
                              {" "}
                              <button onClick={() => setEditing({ ...e })}>Edit</button>{" "}
                              <button onClick={() => setDeleting(e)}>Delete</button>
                            </>
                          )}
                        </>
                      ) : (
                        <form onSubmit={saveEdit} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, alignItems: "center", width: "100%" }}>
                          <input value={editing.title} onChange={(ev) => setEditing({ ...editing, title: ev.target.value })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }} />
                          <input type="time" value={editing.startTime} onChange={(ev) => setEditing({ ...editing, startTime: ev.target.value })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }} />
                          <input type="time" value={editing.endTime} onChange={(ev) => setEditing({ ...editing, endTime: ev.target.value })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }} />
                          <input placeholder="Location" value={editing.location || ""} onChange={(ev) => setEditing({ ...editing, location: ev.target.value })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }} />
                          <select value={editing.category || ""} onChange={(ev) => setEditing({ ...editing, category: ev.target.value })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }}>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          {normalizeCategory(editing.category || "") === "others - specified" && (
                            <input placeholder="Specify category" value={editing.categoryDetail || ""} onChange={(ev) => setEditing({ ...editing, categoryDetail: ev.target.value })} />
                          )}
                          <select value={editing.office ?? ""} onChange={(ev) => setEditing({ ...editing, office: ev.target.value || null })} style={{ backgroundColor: "var(--card)", color: "var(--text)" }}>
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
              const holidayDays = new Set<number>((data?.calendarDays || []).filter((d) => d.holiday).map((d: any) => d.day).filter((n: any) => typeof n === "number"));
              function isWorkingDay(d: Date) {
                const wd = d.getDay();
                return wd >= 1 && wd <= 5;
              }
              function isHoliday(d: Date) {
                if (!data) return false;
                if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return false;
                return holidayDays.has(d.getDate());
              }
              function isFutureOrToday(d: Date) {
                const now = new Date();
                const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                return b.getTime() >= a.getTime();
              }
              function eventHasValidDayInMonth(e: any) {
                if (e.dateType === "range" && e.startDate && e.endDate) {
                  const start = parseDate(e.startDate);
                  const end = parseDate(e.endDate);
                  const cursor = new Date(start);
                  while (cursor <= end) {
                    if (cursor.getFullYear() === year && cursor.getMonth() + 1 === month && isWorkingDay(cursor) && !isHoliday(cursor) && isFutureOrToday(cursor)) {
                      return true;
                    }
                    cursor.setDate(cursor.getDate() + 1);
                  }
                  return false;
                } else if (e.date) {
                  const d = parseDate(e.date);
                  if (d.getFullYear() === year && d.getMonth() + 1 === month && isWorkingDay(d) && !isHoliday(d) && isFutureOrToday(d)) {
                    return true;
                  }
                  return false;
                }
                return false;
              }
              const filtered = listSource
                .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
                .filter((e) => eventHasValidDayInMonth(e));
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
