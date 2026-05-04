import React, { useEffect, useMemo, useState } from "react";
import Calendar from "./Calendar";
import EventDetailModal from "../components/EventDetailModal";
import { api } from "../api";


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
        const isSmall = window.innerWidth < 768;
        setIsPortrait(isSmall || (m ? m.matches : window.innerHeight >= window.innerWidth));
      } catch {
        setIsPortrait(true);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    api.get("/api/offices-data").then((d) => setOfficesData(d));
    api.get("/api/events").then((d) => setEvents(d));
    api.get("/api/holidays").then((d) => setHolidays(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    function load() {
      api.get("/api/events").then((d) => setEvents(d));
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
    workshop: { bg: "var(--cat-workshop-bg)", fg: "var(--cat-workshop-fg)", border: "var(--cat-workshop-bd)" },
    meeting: { bg: "var(--cat-meeting-bg)", fg: "var(--cat-meeting-fg)", border: "var(--cat-meeting-bd)" },
    training: { bg: "var(--cat-training-bg)", fg: "var(--cat-training-fg)", border: "var(--cat-training-bd)" },
    conference: { bg: "var(--cat-conference-bg)", fg: "var(--cat-conference-fg)", border: "var(--cat-conference-bd)" },
    travel: { bg: "var(--cat-travel-bg)", fg: "var(--cat-travel-fg)", border: "var(--cat-travel-bd)" },
    activity: { bg: "var(--cat-activity-bg)", fg: "var(--cat-activity-fg)", border: "var(--cat-activity-bd)" },
    "others - specified": { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" }
  };
  function categoryStyle(cat?: string) {
    const key = normalizeCategory(cat || "");
    const c = CATEGORY_COLORS[key] || { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" };
    return { backgroundColor: c.bg, color: c.fg, borderColor: c.border };
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
    if (s.includes("T")) {
      const d = new Date(s);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
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

  function eventValidOnSpecificDay(e: any, day: Date) {
    return true;
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
          const cursor = new Date(start);
          const monthIndex = viewMonth - 1;
          while (cursor <= end) {
            if (cursor.getFullYear() === viewYear && cursor.getMonth() === monthIndex) {
              return true;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          return false;
        } else if (e.date) {
          const d = parseDate(e.date);
          return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
        }
        return false;
      });
  }, [events, officeFilter, categoryFilter, viewYear, viewMonth]);
  const monthEventsAllCategories = useMemo(() => {
    return events
      .filter((e) => eventMatchesOffice(e, officeFilter))
      .filter((e) => {
        if (e.dateType === "range" && e.startDate && e.endDate) {
          const start = parseDate(e.startDate);
          const end = parseDate(e.endDate);
          const cursor = new Date(start);
          const monthIndex = viewMonth - 1;
          while (cursor <= end) {
            if (cursor.getFullYear() === viewYear && cursor.getMonth() === monthIndex) {
              return true;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          return false;
        } else if (e.date) {
          const d = parseDate(e.date);
          return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth;
        }
        return false;
      });
  }, [events, officeFilter, viewYear, viewMonth]);
  const monthLabel = useMemo(() => {
    try {
      return new Date(viewYear, viewMonth - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    } catch {
      return `${viewMonth}/${viewYear}`;
    }
  }, [viewYear, viewMonth]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of monthEventsAllCategories) {
      const raw = normalizeCategory(e.category || "");
      const cat = CATEGORIES.includes(raw) ? raw : "others - specified";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return CATEGORIES.map((cat) => ({ category: cat, count: counts[cat] || 0 })).filter((x) => x.count > 0);
  }, [monthEventsAllCategories]);

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
      "Legal Division": "LD",
      "Administrative Division": "AD",
      "Finance Division": "FD"
    };
    if (map[n]) return map[n];
    const entry = Object.entries(map).find(([k]) => k.toLowerCase() === n.toLowerCase());
    return entry ? entry[1] : n;
  }

  return (
    <div style={{ padding: 16, background: "var(--bg)", minHeight: "calc(100vh - 100px)" }}>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 340px", gap: 16, alignItems: "stretch" }}>
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
                      boxSizing: "border-box",
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      backgroundColor: "var(--card)",
                      color: "var(--text)",
                      fontSize: 14
                    }}
                  >
                    <option value="">All Offices</option>
                    {officesData && (
                      <>
                        <optgroup label="Top-level Offices">
                          {officesData.topLevelOffices.map((o: { name: string }) => (
                            <option key={o.name} value={o.name}>{isPortrait ? abbreviateOffice(o.name) : o.name}</option>
                          ))}
                        </optgroup>
                        {officesData.services.map((svc: { name: string; offices: Array<{ name: string }> }) => (
                          <optgroup key={svc.name} label={svc.name}>
                            {svc.offices.map((o: { name: string }) => (
                              <option key={o.name} value={o.name}>{isPortrait ? abbreviateOffice(o.name) : o.name}</option>
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
                      background: categoryFilter ? categoryStyle(categoryFilter).backgroundColor : "var(--card)",
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
                            background: styles.backgroundColor,
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
                      background: "var(--secondary-bg)",
                      color: "var(--secondary-color)",
                      border: "1px solid var(--secondary-border)",
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
          {!selectedDate && (
            <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12, background: "var(--secondary-bg)", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Category Counts</div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{monthLabel}</div>
              </div>
              {categoryCounts.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>No events this month</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  {categoryCounts.map(({ category, count }) => {
                    const s = categoryStyle(category);
                    return (
                      <div
                        key={category}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: `1px solid ${s.borderColor}`,
                          background: s.backgroundColor,
                          color: s.color,
                          fontSize: 12,
                          fontWeight: 800
                        }}
                      >
                        <span style={{ textTransform: "capitalize" }}>{category}</span>
                        <span style={{ fontWeight: 900 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                    backgroundColor: categoryStyle(e.category).backgroundColor,
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
