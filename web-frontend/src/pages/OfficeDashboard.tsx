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

  useEffect(() => {
    fetch("/api/offices-data")
      .then((r) => r.json())
      .then((d) => setOfficesData(d));
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d));
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
  const monthEvents = useMemo(() => {
    return events
      .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
      .filter((e) => {
        if (e.dateType === "range" && e.startDate && e.endDate) {
          const start = parseDate(e.startDate);
          const end = parseDate(e.endDate);
          return (start.getFullYear() === viewYear && start.getMonth() + 1 === viewMonth) ||
                 (end.getFullYear() === viewYear && end.getMonth() + 1 === viewMonth) ||
                 (start.getFullYear() <= viewYear && end.getFullYear() >= viewYear &&
                  start.getMonth() + 1 <= viewMonth && end.getMonth() + 1 >= viewMonth);
        } else if (e.date) {
          const d = parseDate(e.date);
          return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
        }
        return false;
      });
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
          return day >= start && day <= end;
        } else if (e.date) {
          const d = parseDate(e.date);
          return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
        }
        return false;
      });
  }, [events, officeFilter, categoryFilter, selectedDate]);

  function canEditEvent(e: any) {
    const user = me;
    if (!user) return false;
    if (String(user.role || "").endsWith("ADMIN")) return true;
    const uid = user.sub || (user as any)?.username;
    return !!(e && e.createdBy && e.createdBy === uid);
  }

  function reloadEvents() {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d));
  }

  const canAdd = !!(me?.role?.endsWith?.("ADMIN") || me?.role?.endsWith?.("OFFICE"));

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 320px", gap: 16 }}>
        <aside className="card hover-scroll" style={{ padding: 12, height: "calc(100vh - 140px)" }}>
          <h3>Regional Office</h3>
          <ul className="list">
            <li
              className="list-item"
              style={{ cursor: "pointer", outline: officeFilter ? "none" : "2px solid var(--primary)" }}
              onClick={() => setOfficeFilter("")}
            >
              <strong>All offices</strong>
            </li>
          </ul>
          <div style={{ marginTop: 8 }}>
            <h4 style={{ margin: "8px 0" }}>Top-level Offices</h4>
            <ul className="list">
              {officesData?.topLevelOffices.map((o: any) => (
                <li
                  key={o.name}
                  className="list-item"
                  onClick={() => setOfficeFilter(o.name)}
                  style={{ cursor: "pointer", outline: officeFilter === o.name ? "2px solid var(--primary)" : "none" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {renderIcon(o.icon, o.name)}
                    <span>{o.name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 8 }}>
            <h4 style={{ margin: "8px 0" }}>Services</h4>
            {officesData?.services.map((s: any) => (
              <div key={s.name} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{s.name}</div>
                <ul className="list">
                  {s.offices.map((o: any) => (
                    <li
                      key={o.name}
                      className="list-item"
                      onClick={() => setOfficeFilter(o.name)}
                      style={{ cursor: "pointer", outline: officeFilter === o.name ? "2px solid var(--primary)" : "none" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {renderIcon(o.icon, o.name)}
                        <span>{o.name}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>
        <main className="card hover-scroll" style={{ padding: 12, height: "calc(100vh - 140px)" }}>
          {canAdd && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                onClick={() => setAddOpen(true)}
                style={{ padding: "6px 12px", borderRadius: 8, background: "var(--primary)", color: "var(--primary-contrast)", border: "none", cursor: "pointer" }}
              >
                Add Event
              </button>
            </div>
          )}
          <Calendar
            officeFilter={officeFilter}
            onOfficeFilterChange={setOfficeFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            hideMonthList={true}
            showScopeToggle={false}
            categoriesAsChips={true}
            showOfficeSelector={false}
            selectedDate={selectedDate ?? undefined}
            onDateSelect={(date) => {
              setSelectedDate(date);
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
        </main>
        <section className="card hover-scroll" style={{ padding: 12, height: "calc(100vh - 140px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>
              {selectedDate ? `Events on ${formatDateLabel(selectedDate)}` : "Upcoming Events This Month"}
            </h3>
            {selectedDate && (
              <span>
                <button
                  onClick={() => { setSelectedDate(null); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: "transparent",
                    color: "#2563eb",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                  aria-label="Clear selected date"
                  title="Clear selected date"
                >
                  <span aria-hidden>×</span>
                  <span>Clear</span>
                </button>
              </span>
            )}
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
                    <strong>{e.title}</strong>
                    {e.category && <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>}
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
