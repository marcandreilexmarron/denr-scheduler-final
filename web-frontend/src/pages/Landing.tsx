import React, { useEffect, useMemo, useState } from "react";
import Calendar from "./Calendar";
import Modal from "../components/Modal";
import EventDetailModal from "../components/EventDetailModal";
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
  TreePalm,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function Landing() {
  const [officeFilter, setOfficeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth() + 1);
  const [officesData, setOfficesData] = useState<{
    topLevelOffices: Array<{ name: string }>;
    services: Array<{ name: string; offices: Array<{ name: string }> }>;
  } | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [isPortrait, setIsPortrait] = useState<boolean>(true);
  const [holidays, setHolidays] = useState<Array<{ month: number; day: number; name: string }>>([]);
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
  const CATEGORIES = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
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
  function parseDate(s: string) {
    if (s.includes("T")) return new Date(s);
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
  function eventValidOnSpecificDay(e: any, day: Date) {
    if (!isWorkingDay(day) || isHoliday(day) || !isFutureOrToday(day)) return false;
    return true;
  }
  function formatTime(t?: string) {
    if (!t) return "";
    const [hh, mm] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  }
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
  const monthEvents = useMemo(() => {
    return events
      .filter((e) => eventMatchesOffice(e, officeFilter) && eventMatchesCategory(e, categoryFilter))
      .filter((e) => {
        if (e.dateType === "range" && e.startDate && e.endDate) {
          const start = parseDate(e.startDate);
          const end = parseDate(e.endDate);
          // include only if there exists at least one working, non-holiday, non-past day in this month
          const cursor = new Date(start);
          const monthIndex = viewMonth - 1;
          while (cursor <= end) {
            if (cursor.getFullYear() === viewYear && cursor.getMonth() === monthIndex && eventValidOnSpecificDay(e, cursor)) {
              return true;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          return false;
        } else if (e.date) {
          const d = parseDate(e.date);
          return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth && eventValidOnSpecificDay(e, d);
        }
        return false;
      });
  }, [events, officeFilter, categoryFilter, viewYear, viewMonth, holidays]);

  const officeNames: string[] = useMemo(() => {
    if (!officesData) return [];
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

  return (
    <div style={{ padding: isPortrait ? 8 : 16 }}>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "minmax(0, 4fr) minmax(0, 1fr)", gap: 16, alignItems: "stretch" }}>
        <aside className="card hover-scroll" style={{ padding: 12, height: "calc(100vh - 140px)", display: "none", gridColumn: "1 / 2" }}>
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
        <main className="card hover-scroll" style={{ padding: "0 12px 12px 12px", minWidth: 0, height: "calc(100vh - 140px)" }}>
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
                    {CATEGORIES.map((c) => {
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
                    onClick={() => { setOfficeFilter(""); setCategoryFilter(""); setSelectedDate(null); }}
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
              </div>
            }
            selectedDate={selectedDate ?? undefined}
            onDateSelect={(date, _events) => {
              setSelectedDate((prev) => (prev === date ? null : date));
            }}
            disableDateModal={true}
            onViewChange={(y, m) => {
              setViewYear(y);
              setViewMonth(m);
              // Clear date selection when month changes
              setSelectedDate(null);
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
                    <div>
                      <span className="badge" style={categoryStyle(e.category)}>{e.category}</span>
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
          />
        </section>
        
      </div>
    </div>
  );
}
