import React from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";

export default function EventDetailModal({
  open,
  onClose,
  event,
  categoryStyle,
  canEditEvent,
  onEdit
}: {
  open: boolean;
  onClose: () => void;
  event: any | null;
  categoryStyle: (c?: string) => React.CSSProperties;
  canEditEvent?: (e: any) => boolean;
  onEdit?: (e: any) => void;
}) {
  const [hoveredOffice, setHoveredOffice] = React.useState<string | null>(null);
  const [hoveredEmployees, setHoveredEmployees] = React.useState<string[]>([]);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [divisionOfficeNames, setDivisionOfficeNames] = React.useState<string[]>([]);
  const [officeServiceMap, setOfficeServiceMap] = React.useState<Record<string, string>>({});
  const [serviceOrder, setServiceOrder] = React.useState<string[]>([]);
  React.useEffect(() => {
    fetch("/api/offices-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const names = Array.isArray(d?.services)
          ? d.services.flatMap((s: any) => (Array.isArray(s.offices) ? s.offices.map((o: any) => o.name) : []))
          : [];
        setDivisionOfficeNames(names);
        const map: Record<string, string> = {};
        const topLabel = "Top-level Offices";
        (Array.isArray(d?.topLevelOffices) ? d.topLevelOffices : []).forEach((o: any) => {
          if (o?.name) map[o.name] = topLabel;
        });
        const order: string[] = [topLabel];
        (Array.isArray(d?.services) ? d.services : []).forEach((s: any) => {
          if (s?.name) {
            order.push(s.name);
            (Array.isArray(s?.offices) ? s.offices : []).forEach((o: any) => {
              if (o?.name) map[o.name] = s.name;
            });
          }
        });
        order.push("Other");
        setOfficeServiceMap(map);
        setServiceOrder(order);
      })
      .catch(() => {});
  }, []);
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
  return (
    <>
    <Modal open={open} onClose={onClose}>
      {event && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {event.category && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge" style={categoryStyle(event.category)}>{event.category}</span>
                  {event.category === "others - specified" && event.categoryDetail && <span className="badge">{event.categoryDetail}</span>}
                </div>
              )}
              <h2 style={{ margin: 0 }}>{event.title}</h2>
            </div>
            {canEditEvent && canEditEvent(event) && onEdit && (
              <button onClick={() => onEdit(event)}>Edit</button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "start", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ color: "var(--muted)" }}>Date & time</div>
            <div>
              {event.dateType === "range" && event.startDate && event.endDate
                ? `${formatFullDate(event.startDate)} ${formatTime(event.startTime)} → ${formatFullDate(event.endDate)} ${formatTime(event.endTime)}`
                : `${formatFullDate(event.date)} ${formatTime(event.startTime)}${event.endTime ? `–${formatTime(event.endTime)}` : ""}`}
            </div>
            {event.location && (
              <>
                <div style={{ color: "var(--muted)" }}>Location</div>
                <div>{event.location}</div>
              </>
            )}
            <div style={{ color: "var(--muted)" }}>From</div>
            <div>{event.creatingOffice || event.office || "Unknown office"}</div>
          </div>
          {event.description && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 12 }}>Description</div>
              <div>{event.description}</div>
            </div>
          )}
          {Array.isArray(event.participants) && event.participants.length > 0 && (() => {
            const raw: string[] = event.participants;
            const byOffice = new Map<string, string[]>();
            const others: string[] = [];
            for (const p of raw) {
              if (p.includes(" — ")) {
                const parts = p.split(" — ");
                const emp = parts[0].trim();
                const off = parts.slice(1).join(" — ").trim();
                if (!byOffice.has(off)) byOffice.set(off, []);
                byOffice.get(off)!.push(emp);
              } else {
                others.push(p);
              }
            }
            const hasAllDivisionOffices = divisionOfficeNames.length > 0 && divisionOfficeNames.every((n) => others.includes(n));
            const othersToRender = hasAllDivisionOffices ? others.filter((x) => !divisionOfficeNames.includes(x)) : others;
            const collapsed = Array.from(byOffice.entries()).filter(([, emps]) => emps.length > 1);
            const singlesFromGrouped = Array.from(byOffice.entries()).filter(([, emps]) => emps.length <= 1).flatMap(([off, emps]) => emps.map((e) => `${e} — ${off}`));
            const groups: Record<string, { collapsed: Array<[string, string[]]>; singles: string[]; officeOnly: string[]; others: string[] }> = {};
            for (const key of serviceOrder.length ? serviceOrder : ["Top-level Offices", "Technical Services", "Management Services", "Other"]) {
              groups[key] = { collapsed: [], singles: [], officeOnly: [], others: [] };
            }
            collapsed.forEach(([off, emps]) => {
              const svc = officeServiceMap[off] || "Other";
              if (!groups[svc]) groups[svc] = { collapsed: [], singles: [], officeOnly: [], others: [] };
              groups[svc].collapsed.push([off, emps]);
            });
            singlesFromGrouped.forEach((p) => {
              const idx = p.lastIndexOf(" — ");
              const off = idx >= 0 ? p.slice(idx + 3).trim() : "";
              const svc = officeServiceMap[off] || "Other";
              if (!groups[svc]) groups[svc] = { collapsed: [], singles: [], officeOnly: [], others: [] };
              groups[svc].singles.push(p);
            });
            const unknown: string[] = [];
            othersToRender.forEach((p) => {
              const svc = officeServiceMap[p];
              if (svc) {
                if (!groups[svc]) groups[svc] = { collapsed: [], singles: [], officeOnly: [], others: [] };
                groups[svc].officeOnly.push(p);
              } else {
                unknown.push(p);
              }
            });
            if (unknown.length) {
              if (!groups["Other"]) groups["Other"] = { collapsed: [], singles: [], officeOnly: [], others: [] };
              groups["Other"].others.push(...unknown);
            }
            return (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 12 }}>Participants</div>
                {hasAllDivisionOffices && (
                  <div style={{ marginBottom: 6 }}>
                    <span
                      className="badge"
                      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                    >
                      Division Chiefs
                    </span>
                  </div>
                )}
                {(serviceOrder.length ? serviceOrder : Object.keys(groups)).map((svc) => {
                  const g = groups[svc];
                  if (!g || (g.collapsed.length === 0 && g.singles.length === 0 && g.officeOnly.length === 0 && g.others.length === 0)) return null;
                  return (
                    <div key={`svc-${svc}`} style={{ marginBottom: 8 }}>
                      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>{svc}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {g.collapsed.map(([off, emps]) => (
                          <span
                            key={`off-${svc}-${off}`}
                            className="badge"
                            style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
                            onMouseEnter={(e) => {
                              setHoveredOffice(off);
                              setHoveredEmployees(emps);
                              const el = e.currentTarget as HTMLElement;
                              setAnchorRect(el.getBoundingClientRect());
                            }}
                            onMouseLeave={() => setHoveredOffice((v) => (v === off ? null : v))}
                          >
                            {off}
                            <span
                              aria-hidden
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                opacity: 0.85,
                                padding: "0 6px",
                                border: "1px solid var(--border)",
                                borderRadius: 999,
                                lineHeight: "16px",
                                background: "var(--card)",
                                color: "inherit"
                              }}
                            >
                              +{emps.length}
                            </span>
                          </span>
                        ))}
                        {g.singles.map((p, idx) => (
                          <span key={`sg-${svc}-${idx}`} className="badge">{p}</span>
                        ))}
                        {g.officeOnly.map((p, idx) => (
                          <span key={`oo-${svc}-${idx}`} className="badge">{p}</span>
                        ))}
                        {g.others.map((p, idx) => (
                          <span key={`ot-${svc}-${idx}`} className="badge">{p}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {Array.isArray(event.attachments) && event.attachments.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 12 }}>Attachments</div>
              <ul className="list">
                {event.attachments.map((a: any, i: number) => {
                  const label = typeof a === "string" ? a : a?.name || a?.url || `Attachment ${i + 1}`;
                  const url = typeof a === "string" ? a : a?.url;
                  return (
                    <li key={i} className="list-item">
                      {url ? <a href={url} target="_blank" rel="noreferrer">{label}</a> : <span>{label}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
    {hoveredOffice && hoveredOffice !== "Division Chiefs" && anchorRect && createPortal(
      <div
        style={{
          position: "fixed",
          zIndex: 2000,
          top: Math.round(anchorRect.bottom + 4),
          left: Math.round(Math.min(anchorRect.left, window.innerWidth - 320)),
          maxWidth: 320,
          padding: "6px 8px",
          background: "var(--card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          whiteSpace: "normal",
          wordBreak: "break-word"
        }}
        role="tooltip"
      >
        <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 240, overflow: "auto" }}>
          {hoveredEmployees.map((name, i) => (
            <li key={`${name}-${i}`} style={{ padding: "2px 0" }}>{name}</li>
          ))}
        </ul>
      </div>,
      document.body
    )}
    </>
  );
}
