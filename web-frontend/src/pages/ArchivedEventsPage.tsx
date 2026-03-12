import React, { useEffect, useMemo, useState } from "react";
import { getUserFromToken } from "../auth";
import EventDetailModal from "../components/EventDetailModal";

type OfficesData = {
  topLevelOffices: Array<{ name: string }>;
  services: Array<{ name: string; offices: Array<{ name: string }> }>;
};

const CATEGORIES = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
const CATEGORY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  workshop: { bg: "#eef7ff", fg: "#0b5ed7", border: "#b6d4fe" },
  meeting: { bg: "#e8f5e9", fg: "#1b5e20", border: "#c8e6c9" },
  training: { bg: "#fff8e1", fg: "#8d6e63", border: "#ffecb3" },
  conference: { bg: "#f3e5f5", fg: "#4a148c", border: "#e1bee7" },
  travel: { bg: "#e0f7fa", fg: "#006064", border: "#b2ebf2" },
  activity: { bg: "#fce4ec", fg: "#880e4f", border: "#f8bbd0" },
  "others - specified": { bg: "#f5f5f5", fg: "#424242", border: "#e0e0e0" }
};
function normalizeCategory(s: string) {
  return String(s || "").trim().toLowerCase();
}
function categoryStyle(cat?: string) {
  const key = normalizeCategory(cat || "");
  const c = CATEGORY_COLORS[key] || { bg: "#eeeeee", fg: "#333333", border: "#dddddd" };
  return { background: c.bg, color: c.fg, borderColor: c.border };
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

  useEffect(() => {
    fetch("/api/offices-data").then((r) => r.json()).then((d) => setOfficesData(d));
    fetch("/api/events/archive").then((r) => r.json()).then((d) => setEvents(d));
  }, []);

  const availableOffices = useMemo(() => {
    if (!officesData) return [] as string[];
    return [
      ...officesData.topLevelOffices.map((o) => o.name),
      ...officesData.services.flatMap((s) => s.offices.map((o) => o.name))
    ];
  }, [officesData]);

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
  const todayKey = (() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const archived = useMemo(() => {
    return events
      .filter((e) => {
        const ed = effectiveDate(e);
        return ed && ed < todayKey;
      })
      .filter((e) => eventOfficeMatch(e, officeFilter) && eventCategoryMatch(e, categoryFilter))
      .sort((a, b) => {
        const da = effectiveDate(a);
        const db = effectiveDate(b);
        return db.localeCompare(da); // newest past first
      });
  }, [events, officeFilter, categoryFilter, todayKey]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 300px", minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Office</label>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
          >
            <option value="">All Offices</option>
            {officesData && (
              <>
                <optgroup label="Top-level Offices">
                  {officesData.topLevelOffices.map((o) => (
                    <option key={o.name} value={o.name}>{o.name}</option>
                  ))}
                </optgroup>
                {officesData.services.map((svc) => (
                  <optgroup key={svc.name} label={svc.name}>
                    {svc.offices.map((o) => (
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
                <option key={c} value={c} style={{ background: styles.background, color: styles.color, fontWeight: 700 }}>
                  {c}
                </option>
              );
            })}
          </select>
        </div>
        <button
          onClick={() => { setOfficeFilter(""); setCategoryFilter(""); }}
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
        >
          Clear Filters
        </button>
      </div>
      <div className="card hover-scroll" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", gap: 8, fontWeight: 700, marginBottom: 8 }}>
          <div>Category</div>
          <div>Title Event</div>
          <div>Date</div>
        </div>
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
                style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", gap: 8, alignItems: "center", cursor: "pointer" }}
                title="View event details"
              >
                <div>
                  {e.category ? (
                    <span className="badge" style={{ ...styles, border: `1px solid ${styles.borderColor}` }}>{e.category}</span>
                  ) : (
                    <span className="badge">uncategorized</span>
                  )}
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong>{e.title}</strong>
                  {e.location ? <span style={{ color: "var(--muted)" }}> @ {e.location}</span> : null}
                </div>
                <div>{dateLabel}</div>
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
