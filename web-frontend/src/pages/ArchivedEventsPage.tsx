import { useEffect, useMemo, useState } from "react";
import { getUserFromToken } from "../auth";
import EventDetailModal from "../components/EventDetailModal";
import { api } from "../api";

type OfficesData = {
  topLevelOffices: Array<{ name: string }>;
  services: Array<{ name: string; offices: Array<{ name: string }> }>;
};

const CATEGORIES = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
const CATEGORY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  workshop: { bg: "var(--cat-workshop-bg)", fg: "var(--cat-workshop-fg)", border: "var(--cat-workshop-bd)" },
  meeting: { bg: "var(--cat-meeting-bg)", fg: "var(--cat-meeting-fg)", border: "var(--cat-meeting-bd)" },
  training: { bg: "var(--cat-training-bg)", fg: "var(--cat-training-fg)", border: "var(--cat-training-bd)" },
  conference: { bg: "var(--cat-conference-bg)", fg: "var(--cat-conference-fg)", border: "var(--cat-conference-bd)" },
  travel: { bg: "var(--cat-travel-bg)", fg: "var(--cat-travel-fg)", border: "var(--cat-travel-bd)" },
  activity: { bg: "var(--cat-activity-bg)", fg: "var(--cat-activity-fg)", border: "var(--cat-activity-bd)" },
  "others - specified": { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" }
};
function normalizeCategory(s: string) {
  return String(s || "").trim().toLowerCase();
}
function categoryStyle(cat?: string) {
  const key = normalizeCategory(cat || "");
  const c = CATEGORY_COLORS[key] || { bg: "var(--cat-others-bg)", fg: "var(--cat-others-fg)", border: "var(--cat-others-bd)" };
  return { backgroundColor: c.bg, color: c.fg, borderColor: c.border };
}
function formatFullDate(s: any) {
  if (!s) return "";
  try {
    let date: Date;
    if (s instanceof Date) {
      date = s;
    } else if (typeof s === "string" && s.includes("T")) {
      date = new Date(s);
    } else if (typeof s === "string") {
      const [y, m, d] = s.split("-").map(Number);
      date = new Date(y, m - 1, d);
    } else {
      return String(s);
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(s);
  }
}

export default function ArchivedEventsPage() {
  const user = getUserFromToken();
  const [officesData, setOfficesData] = useState<OfficesData | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [officeFilter, setOfficeFilter] = useState<string>(user?.officeName || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [detailEvent, setDetailEvent] = useState<any | null>(null);

  const [isPortrait, setIsPortrait] = useState(false);
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

  useEffect(() => {
    api.get("/api/offices-data").then((d) => setOfficesData(d));
    api.get("/api/events/archive").then((d) => setEvents(d));
  }, []);


  function eventOfficeMatch(e: any, office: string) {
    if (!office) return true;
    const target = office.toLowerCase().trim();
    if (e.office && e.office.toLowerCase().trim() === target) return true;
    if (Array.isArray(e.participants)) {
      return e.participants.some((p: any) => String(p).toLowerCase().includes(target));
    }
    return false;
  }
  function eventCategoryMatch(e: any, cat: string) {
    if (!cat) return true;
    return normalizeCategory(e.category || "") === normalizeCategory(cat);
  }
  function effectiveDate(e: any) {
    let val = e.dateType === "range" ? (e.endDate || e.startDate) : e.date;
    if (!val) return "";
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, "0");
      const d = String(val.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (typeof val === "string" && val.includes("T")) return val.split("T")[0];
    return String(val);
  }
  const archived = useMemo(() => {
    return events
      .filter((e) => eventOfficeMatch(e, officeFilter) && eventCategoryMatch(e, categoryFilter))
      .sort((a, b) => {
        const da = effectiveDate(a);
        const db = effectiveDate(b);
        return db.localeCompare(da); // newest past first
      });
  }, [events, officeFilter, categoryFilter]);
  const allArchivedAllCategories = useMemo(() => {
    return events
      .filter((e) => eventOfficeMatch(e, officeFilter));
  }, [events, officeFilter]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of allArchivedAllCategories) {
      const raw = normalizeCategory(e.category || "");
      const cat = CATEGORIES.includes(raw) ? raw : "others - specified";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return CATEGORIES.map((cat) => ({ category: cat, count: counts[cat] || 0 })).filter((x) => x.count > 0);
  }, [allArchivedAllCategories]);

  return (
    <div style={{ padding: isPortrait ? 8 : 16, maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden", background: "var(--bg)", minHeight: "calc(100vh - 100px)" }}>
      <div className="card hover-scroll" style={{ padding: 0, maxWidth: "100%", overflowX: "hidden" }}>
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", background: "var(--card)", borderTop: "4px solid var(--primary)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isPortrait ? "1fr" : "2fr 1fr 140px",
              alignItems: "end",
              gap: 8,
              maxWidth: "100%"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Select Office</label>
              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "100%",
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
                      {officesData.topLevelOffices.map((o) => (
                        <option key={o.name} value={o.name}>{isPortrait ? abbreviateOffice(o.name) : o.name}</option>
                      ))}
                    </optgroup>
                    {officesData.services.map((svc) => (
                      <optgroup key={svc.name} label={svc.name}>
                        {svc.offices.map((o) => (
                          <option key={o.name} value={o.name}>{isPortrait ? abbreviateOffice(o.name) : o.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div style={{ minWidth: 0 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
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
                    <option key={c} value={c} style={{ background: styles.backgroundColor, color: styles.color, fontWeight: 700 }}>
                      {c}
                    </option>
                  );
                })}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, maxWidth: "100%", justifyContent: isPortrait ? "start" : "end" }}>
              <button
                type="button"
                onClick={() => { setOfficeFilter(""); setCategoryFilter(""); }}
                style={{
                  padding: "10px 12px",
                  background: "var(--accent)",
                  color: "white",
                  border: "1px solid var(--accent)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  width: 140,
                  boxSizing: "border-box",
                  flex: "0 0 auto"
                }}
                title="Clear filters"
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12, background: "var(--secondary-bg)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Category Counts</div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>All time</div>
            </div>
            {categoryCounts.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>No archived events</div>
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
        </div>
        {!isPortrait && (
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", gap: 8, fontWeight: 700, marginBottom: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
            <div>Category</div>
            <div>Title Event</div>
            <div>Date</div>
          </div>
        )}
        {archived.length === 0 ? (
          <div className="list-item">No archived events</div>
        ) : (
          archived.map((e) => {
            const styles = categoryStyle(e.category);
            const isRange = String(e?.dateType || "single") === "range";
            const dateLabel = isRange
              ? `${formatFullDate(e.startDate)} – ${formatFullDate(e.endDate || e.startDate)}`
              : `${formatFullDate(e.date)}`;
            return (
              <div
                key={e.id ?? `${e.title}-${effectiveDate(e)}`}
                className="list-item"
                onClick={() => setDetailEvent(e)}
                style={{ 
                  display: "grid", 
                  gridTemplateColumns: isPortrait ? "1fr" : "160px 1fr 180px", 
                  gap: isPortrait ? 4 : 8, 
                  alignItems: isPortrait ? "flex-start" : "center", 
                  cursor: "pointer",
                  padding: isPortrait ? "12px" : "8px 12px"
                }}
                title="View event details"
              >
                <div style={{ order: isPortrait ? 2 : 1 }}>
                  {e.category ? (
                    <span className="badge" style={{ ...styles, border: `1px solid ${styles.borderColor}` }}>{e.category}</span>
                  ) : (
                    <span className="badge">uncategorized</span>
                  )}
                </div>
                <div style={{ 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: isPortrait ? "normal" : "nowrap",
                  order: isPortrait ? 1 : 2
                }}>
                  <strong style={{ fontSize: isPortrait ? 15 : 14 }}>{e.title}</strong>
                  {e.location ? <span style={{ color: "var(--muted)", fontSize: 13 }}> @ {e.location}</span> : null}
                  {isPortrait && e.office && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {abbreviateOffice(e.office)}
                    </div>
                  )}
                </div>
                <div style={{ 
                  order: isPortrait ? 3 : 3,
                  fontSize: isPortrait ? 12 : 14,
                  color: isPortrait ? "var(--muted)" : "inherit"
                }}>
                  {dateLabel}
                </div>
              </div>
            );
          })
        )}
      </div>
      <EventDetailModal
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        categoryStyle={categoryStyle}
        canEditEvent={() => false}
        onEdit={() => {}}
      />
    </div>
  );
}
