import React, { useEffect, useMemo, useState } from "react";
import Calendar from "./Calendar";
import Modal from "../components/Modal";
import EventDetailModal from "../components/EventDetailModal";
import AddEventModal from "../components/AddEventModal";
import { getUserFromToken, getToken } from "../auth";
import {
  Building2,
  TreePine,
  Layers,
  Landmark,
  Users,
  Leaf,
  Droplets,
  Map as MapIcon,
  Mountain,
  ShieldCheck,
  ClipboardList,
  Banknote,
  Recycle,
  Wind,
  Factory,
  Ship,
  Flame,
  Hammer,
  Briefcase,
  Book,
  Microscope,
  Truck,
  Globe,
  Fish,
  Sprout,
  TreeDeciduous,
  TreePalm
} from "lucide-react";

export default function OfficeDashboard() {
  const me = getUserFromToken();
  const [officeFilter, setOfficeFilter] = useState<string>(me?.officeName || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth() + 1);
  const [officesData, setOfficesData] = useState<{ topLevelOffices: any[]; services: any[] } | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [holidays, setHolidays] = useState<Array<{ month: number; day: number; name: string }>>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [isPortrait, setIsPortrait] = useState<boolean>(true);
  useEffect(() => {
    function update() {
      try {
        const m = window.matchMedia && window.matchMedia("(orientation: portrait)");
        setIsPortrait(m ? m.matches : window.innerHeight >= window.innerWidth);
      } catch {
        setIsPortrait(true);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    fetch("/api/offices-data")
      .then((r) => r.json())
      .then((d) => setOfficesData(d));
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d));
    fetch("/api/holidays")
      .then((r) => r.json())
      .then((d) => setHolidays(Array.isArray(d) ? d : []));
  }, []);

  const CATEGORY_OPTIONS = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
  const availableOffices = useMemo(() => {
    if (!officesData) return [] as string[];
    return [
      ...officesData.topLevelOffices.map((o: any) => o.name),
      ...officesData.services.flatMap((s: any) => s.offices.map((o: any) => o.name))
    ];
  }, [officesData]);

  const categoryIcons = useMemo(() => {
    return {
      forest: [TreePine, TreeDeciduous, TreePalm, Leaf, Sprout],
      water: [Droplets, Fish, Ship],
      land: [MapIcon, Layers, Globe],
      mines: [Mountain, Hammer, Microscope],
      enforce: [ShieldCheck, Hammer],
      plan: [ClipboardList, Book],
      finance: [Banknote, Briefcase],
      waste: [Recycle, Factory, Truck],
      air: [Wind, Flame, Globe],
      admin: [Building2, Landmark, Briefcase, Users],
      generic: [Users, Globe, Layers]
    };
  }, []);
  function categorize(name: string) {
    const n = name.toLowerCase();
    if (/(forest|tree|pine|wood|cfr|nfp|fores)/.test(n)) return "forest";
    if (/(water|river|lake|coast|marine|ocean|hydro)/.test(n)) return "water";
    if (/(land\s?(use|mgmt|manage)|gis|map|cadastre|survey)/.test(n)) return "land";
    if (/(mine|mineral|geolog|mountain)/.test(n)) return "mines";
    if (/(enforce|law|legal|compliance|patrol|protection)/.test(n)) return "enforce";
    if (/(plan|policy|program)/.test(n)) return "plan";
    if (/(finance|budget|account|treasury)/.test(n)) return "finance";
    if (/(waste|recycl|solid)/.test(n)) return "waste";
    if (/(air|climate|emission|wind)/.test(n)) return "air";
    if (/(admin|administration|management|office|regional)/.test(n)) return "admin";
    if (/(service|division|bureau|department)/.test(n)) return "admin";
    return "generic";
  }
  const allOfficeNames = useMemo(() => {
    if (!officesData) return [] as string[];
    const a = officesData.topLevelOffices.map((o: any) => o.name);
    const b = officesData.services.flatMap((s: any) => s.offices.map((o: any) => o.name));
    return [...a, ...b];
  }, [officesData]);
  const officeIconMap = useMemo(() => {
    const map = new Map<string, any>();
    const used = new Set<any>();
    function hashName(n: string) {
      let h = 0;
      for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
      return h;
    }
    for (const n of allOfficeNames) {
      const cat = categorize(n);
      const arr = (categoryIcons as any)[cat] as any[];
      let idx = hashName(n) % arr.length;
      let picked = arr[idx];
      let tries = 0;
      while (used.has(picked) && tries < arr.length) {
        idx = (idx + 1) % arr.length;
        picked = arr[idx];
        tries++;
      }
      if (used.has(picked)) {
        const all = Object.values(categoryIcons).flat() as any[];
        let j = hashName(n) % all.length;
        let p2 = all[j];
        let t2 = 0;
        while (used.has(p2) && t2 < all.length) {
          j = (j + 1) % all.length;
          p2 = all[j];
          t2++;
        }
        picked = p2;
      }
      used.add(picked);
      map.set(n, picked);
    }
    return map;
  }, [allOfficeNames, categoryIcons]);
  function renderIcon(icon?: string, name?: string) {
    const size = 18;
    const boxStyle = { width: 20, height: 20, minWidth: 20, minHeight: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" } as const;
    const svgStyle = { width: size, height: size } as const;
    if (name && officeIconMap.has(name)) {
      const Cmp = officeIconMap.get(name)!;
      return <span style={boxStyle}><Cmp style={svgStyle} aria-hidden /></span>;
    }
    if (icon) {
      const srcLike = /^(https?:|data:|\/)/.test(icon) || /\.(png|jpe?g|gif|svg)$/i.test(icon);
      if (srcLike) {
        return <span style={boxStyle}><img src={icon} alt="" style={{ width: size, height: size, objectFit: "contain" }} aria-hidden /></span>;
      }
      if (!/^[A-Za-z0-9\-\s]+$/.test(icon)) {
        return <span style={boxStyle}><span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span></span>;
      }
    }
    return <span style={boxStyle}><Building2 style={svgStyle} aria-hidden /></span>;
  }
  useEffect(() => {
    function load() {
      fetch("/api/events")
        .then((r) => r.json())
        .then((d) => setEvents(d));
    }
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(load, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, []);

  // categoryStyle and other helpers continue below
  function normalizeCategory(s: string) {
    return String(s || "").trim().toLowerCase();
  }
  const CATEGORY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
    workshop: { bg: "#eef7ff", fg: "#0b5ed7", border: "#b6d4fe" },
    meeting: { bg: "#e8f5e9", fg: "#1b5e20", border: "#c8e6c9" },
    training: { bg: "#fff8e1", fg: "#8d6e63", border: "#ffecb3" },
    conference: { bg: "#f3e5f5", fg: "#4a148c", border: "#e1bee7" },
    travel: { bg: "#e0f7fa", fg: "#006064", border: "#b2ebf2" },
    activity: { bg: "#fce4ec", fg: "#880e4f", border: "#f8bbd0" },
    "others - specified": { bg: "#f5f5f5", fg: "#424242", border: "#e0e0e0" }
  };
  function categoryStyle(cat?: string) {
    const key = normalizeCategory(cat || "");
    const c = CATEGORY_COLORS[key] || { bg: "#eeeeee", fg: "#333333", border: "#dddddd" };
    return { background: c.bg, color: c.fg, borderColor: c.border };
  }
  function eventMatchesOffice(e: any, officeName: string) {
    if (!officeName) return true;
    if (e.office && e.office === officeName) return true;
    if (Array.isArray(e.participants) && e.participants.includes(officeName)) return true;
    return false;
  }
  function eventMatchesCategory(e: any, cat: string) {
    if (!cat) return true;
    return normalizeCategory(e.category || "") === normalizeCategory(cat);
  }
  function parseDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function formatDateLabel(s: string) {
    try {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return s;
    }
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
    const [hh, mm] = (t || "").split(":").map((n) => Number(n));
    const d = new Date();
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
  function isWorkingDay(d: Date) {
    const wd = d.getDay();
    return wd >= 1 && wd <= 5;
  }
  function isHoliday(d: Date) {
    return holidays.some((h) => h.month === d.getMonth() + 1 && h.day === d.getDate());
  }
  function isFutureOrToday(d: Date) {
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return b.getTime() >= a.getTime();
  }
  function withinBusinessHours(e: any) {
    const s = String(e.startTime || "");
    const t = String(e.endTime || "");
    if (!/^\d{2}:\d{2}$/.test(s) || !/^\d{2}:\d{2}$/.test(t)) return false;
    return s >= "08:00" && t <= "17:00";
  }
  function eventHasValidDayInMonth(e: any, y: number, m: number) {
    if (!withinBusinessHours(e)) return false;
    if (e.dateType === "range" && e.startDate && e.endDate) {
      const start = parseDate(e.startDate);
      const end = parseDate(e.endDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor.getFullYear() === y && cursor.getMonth() + 1 === m && isWorkingDay(cursor) && !isHoliday(cursor) && isFutureOrToday(cursor)) {
          return true;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return false;
    } else if (e.date) {
      const d = parseDate(e.date);
      if (d.getFullYear() === y && d.getMonth() + 1 === m && isWorkingDay(d) && !isHoliday(d) && isFutureOrToday(d)) {
        return withinBusinessHours(e);
      }
      return false;
    }
    return false;
  }
  function eventValidOnSpecificDay(e: any, day: Date) {
    if (!withinBusinessHours(e)) return false;
    if (!isWorkingDay(day) || isHoliday(day) || !isFutureOrToday(day)) return false;
    return true;
  }
  const monthEvents = useMemo(() => {
    return events
      .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
      .filter((e) => eventHasValidDayInMonth(e, viewYear, viewMonth));
  }, [events, officeFilter, categoryFilter, viewYear, viewMonth]);
  const selectedDateEventsComputed = useMemo(() => {
    if (!selectedDate) return [];
    const day = parseDate(selectedDate);
    return events
      .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
      .filter((e) => {
        if (e.dateType === "range" && e.startDate && e.endDate) {
          const start = parseDate(e.startDate);
          const end = parseDate(e.endDate);
          if (day < start || day > end) return false;
          return eventValidOnSpecificDay(e, day);
        } else if (e.date) {
          const d = parseDate(e.date);
          if (!(d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate())) return false;
          return eventValidOnSpecificDay(e, day);
        }
        return false;
      });
  }, [events, officeFilter, categoryFilter, selectedDate, holidays]);

  function canEditEvent(e: any) {
    const user = me;
    if (!user) return false;
    if (String(user.role || "").endsWith("ADMIN")) return true;
    const myOffice = user.officeName || "";
    return !!(e && (e.office === myOffice || e.createdByOffice === myOffice));
  }

  function reloadEvents() {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d));
  }

  const canAdd = !!(me?.role?.endsWith?.("ADMIN") || me?.role?.endsWith?.("OFFICE"));
  function deleteEvent(id: string) {
    const t = getToken();
    if (!t) return;
    fetch(`/api/events/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${t}` } })
      .then((r) => {
        if (r.status === 204) {
          reloadEvents();
        } else {
          return r.json().then((j) => {
            alert(j?.error || "Delete failed");
          }).catch(() => alert("Delete failed"));
        }
      })
      .catch(() => alert("Delete failed"));
  }
  // Removed inline saveEdit in favor of using AddEventModal in edit mode

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "minmax(0, 4fr) minmax(0, 1fr)", gap: 16 }}>
        <main className="card hover-scroll" style={{ padding: "0 12px 12px 12px", height: "calc(100vh - 140px)" }}>
          <Calendar
            officeFilter={officeFilter}
            onOfficeFilterChange={setOfficeFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            hideMonthList={true}
            showScopeToggle={false}
            categoriesAsChips={false}
            showOfficeSelector={false}
            showCategorySelector={false}
            showTitle={false}
            headerBelow={
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 300px", minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Select Office</label>
                  <select
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "var(--card)",
                      fontSize: 14
                    }}
                  >
                    <option value="">All Offices</option>
                    {officesData && (
                      <>
                        <optgroup label="Top-level Offices">
                          {officesData.topLevelOffices.map((o: { name: string }) => (
                            <option key={o.name} value={o.name}>{o.name}</option>
                          ))}
                        </optgroup>
                        {officesData.services.map((svc: { name: string; offices: Array<{ name: string }> }) => (
                          <optgroup key={svc.name} label={svc.name}>
                            {svc.offices.map((o: { name: string }) => (
                              <option key={o.name} value={o.name}>{o.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div style={{ width: 260 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      border: `2px solid ${categoryFilter ? categoryStyle(categoryFilter).borderColor : "var(--border)"}`,
                      borderRadius: 10,
                      background: categoryFilter ? categoryStyle(categoryFilter).background : "var(--card)",
                      color: categoryFilter ? categoryStyle(categoryFilter).color : "inherit",
                      fontSize: 14,
                      fontWeight: 700,
                      boxShadow: categoryFilter ? `0 0 0 3px ${categoryStyle(categoryFilter).borderColor}` : "none",
                      filter: categoryFilter ? "saturate(1.35) brightness(1.05)" : "none"
                    }}
                  >
                    <option value="">All Categories</option>
                    {CATEGORY_OPTIONS.map((c) => {
                      const styles = categoryStyle(c);
                      return (
                        <option
                          key={c}
                          value={c}
                          style={{
                            background: styles.background,
                            color: styles.color,
                            fontWeight: 700
                          }}
                        >
                          {c}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => { setOfficeFilter(me?.officeName || ""); setCategoryFilter(""); setSelectedDate(null); }}
                    style={{
                      padding: "10px 12px",
                      background: "#e2e8f0",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600
                    }}
                    title="Clear filters"
                    aria-label="Clear filters"
                  >
                    Clear Filters
                  </button>
                </div>
                {canAdd && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setAddOpen(true)}
                      style={{
                        padding: "10px 12px",
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "1px solid #1d4ed8",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 600
                      }}
                      title="Add Event"
                      aria-label="Add Event"
                    >
                      Add Event
                    </button>
                  </div>
                )}
              </div>
            }
            selectedDate={selectedDate ?? undefined}
            onDateSelect={(date, _events) => {
              setSelectedDate((prev) => (prev === date ? null : date));
            }}
            disableDateModal={true}
            allowCreate={true}
            canEditEvent={(e, user) => {
              if (String(user?.role || "").endsWith("ADMIN")) return true;
              return !!(e && e.createdBy && (e.createdBy === user?.sub || e.createdBy === (user as any)?.username));
            }}
            onViewChange={(y, m) => {
              setViewYear(y);
              setViewMonth(m);
              setSelectedDate(null);
            }}
          />
          <AddEventModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            defaultDate={selectedDate ?? `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`}
            categories={CATEGORY_OPTIONS}
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
                });
            }}
          />
          <AddEventModal
            open={!!editing}
            onClose={() => setEditing(null)}
            defaultDate={
              editing
                ? (editing.date || editing.startDate || `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`)
                : `${viewYear}-${String(viewMonth).padStart(2, "0")}-01`
            }
            categories={CATEGORY_OPTIONS}
            availableOffices={availableOffices}
            officesData={officesData ?? undefined}
            mode="edit"
            initialEvent={editing ?? undefined}
            submitLabel="Save"
            title="Edit Event"
            onSubmit={(payload) => {
              const t = getToken();
              if (!t || !editing) return;
              const body = { ...editing, ...payload };
              fetch(`/api/events/${editing.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
                body: JSON.stringify(body)
              })
                .then((r) => r.json())
                .then((res) => {
                  if ((res as any)?.error) {
                    alert((res as any).error);
                    return;
                  }
                  setEditing(null);
                  reloadEvents();
                })
                .catch(() => alert("Save failed"));
            }}
          />
        </main>
        <section className="card hover-scroll" style={{ padding: 12, height: "calc(100vh - 140px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>
              {selectedDate ? `Events on ${formatDateLabel(selectedDate)}` : "Upcoming Events This Month"}
            </h3>
          </div>
          <ul className="list">
            {(selectedDate ? selectedDateEventsComputed : monthEvents).length === 0 ? (
              <li className="list-item">No events are scheduled</li>
            ) : (
              (selectedDate ? selectedDateEventsComputed : monthEvents).map((e, i) => (
                <li
                  key={e.id ?? i}
                  className="list-item"
                  onClick={() => setDetailEvent(e)}
                  style={{
                    cursor: "pointer",
                    background: categoryStyle(e.category).background,
                    color: categoryStyle(e.category).color,
                    borderLeft: `4px solid ${categoryStyle(e.category).borderColor}`
                  }}
                >
                  <div>
                    <div>
                      <strong>{e.title}</strong>
                    </div>
                    {e.category && (
                      <div style={{ marginTop: 4 }}>
                        <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>
                      </div>
                    )}
                    {canEditEvent(e) && (
                      <div style={{ marginTop: 6, display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setEditing({ ...e }); }}
                          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #93c5fd", background: "#dbeafe", color: "#1d4ed8", cursor: "pointer" }}
                          title="Edit event"
                          aria-label="Edit event"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (confirm("Delete this event?")) deleteEvent(e.id);
                          }}
                          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ef4444", background: "#fee2e2", color: "#991b1b", cursor: "pointer" }}
                          title="Delete event"
                          aria-label="Delete event"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
          <EventDetailModal
            open={!!detailEvent}
            onClose={() => setDetailEvent(null)}
            event={detailEvent}
            categoryStyle={categoryStyle}
            canEditEvent={(e) => canEditEvent(e)}
            onEdit={() => alert("Open the date cell and use Edit in calendar modal")}
          />
          
        </section>
      </div>
    </div>
  );
}
