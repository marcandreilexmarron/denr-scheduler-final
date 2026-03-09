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
  const [selectedOffice, setSelectedOffice] = React.useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = React.useState<string[]>([]);
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
      if (s.includes("T")) return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  React.useEffect(() => {
    if (!open) {
      setSelectedOffice(null);
      setSelectedEmployees([]);
    }
  }, [open, event]);
  React.useEffect(() => {
    setSelectedOffice(null);
    setSelectedEmployees([]);
  }, [event]);
  const handleClose = React.useCallback(() => {
    setSelectedOffice(null);
    setSelectedEmployees([]);
    onClose();
  }, [onClose]);
  return (
    <>
    <Modal open={open} onClose={handleClose}>
      {event && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {event.category && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge" style={categoryStyle(event.category)}>{event.category}</span>
                  {event.category === "others - specified" && event.categoryDetail && <span className="badge">{event.categoryDetail}</span>}
                </div>
              )}
              <h2 style={{ margin: 0 }}>{event.title}</h2>
              {(() => {
                const cat = String(event.category || "").trim().toLowerCase();
                if (cat === "workshop" || cat === "training") {
                  return <div style={{ fontSize: 12, color: "var(--muted)" }}>A report will be needed after the event.</div>;
                }
                return null;
              })()}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", alignItems: "baseline", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.9em" }}>Date & time</div>
            <div>
              {event.dateType === "range" && event.startDate && event.endDate
                ? `${formatFullDate(event.startDate)} ${formatTime(event.startTime)} → ${formatFullDate(event.endDate)} ${formatTime(event.endTime)}`
                : `${formatFullDate(event.date)} ${formatTime(event.startTime)}${event.endTime ? `–${formatTime(event.endTime)}` : ""}`}
            </div>
            {event.location && (
              <>
                <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.9em" }}>Location</div>
                <div style={{ overflowWrap: "anywhere" }}>{event.location}</div>
              </>
            )}
            <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.9em" }}>From</div>
            <div>{event.creatingOffice || event.office || "Unknown office"}</div>
          </div>
          {event.description && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 12 }}>Description</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{event.description}</div>
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
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
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
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%" }}>
                        {g.collapsed.map(([off, emps]) => (
                          <span
                            key={`off-${svc}-${off}`}
                            className="badge"
                            style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                            onClick={() => {
                              setSelectedOffice(off);
                              setSelectedEmployees(emps);
                            }}
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
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, gridColumn: "1 / 2" }}>
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
          {canEditEvent && canEditEvent(event) && onEdit && (
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 10, gridColumn: "1 / 2" }}>
              <button
                onClick={() => onEdit(event)}
                style={{
                  padding: "8px 10px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "1px solid #1d4ed8",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600
                }}
                title="Edit event"
                aria-label="Edit event"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
    {open && selectedOffice && selectedEmployees.length > 0
      ? createPortal((() => {
          try {
            const el = document.querySelector(".modal-card") as HTMLElement | null;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const panelWidth = 300;
            const gap = 8;
            const left = Math.min(rect.right + gap, window.innerWidth - panelWidth - 8);
            const top = Math.max(8, rect.top);
            const maxHeight = Math.min(rect.height, window.innerHeight - top - 8);
            return (
              <div
                style={{
                  position: "fixed",
                  zIndex: 1100,
                  top,
                  left,
                  width: panelWidth,
                  maxHeight,
                  overflow: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--card)",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.12)"
                }}
                role="dialog"
                aria-label={`${selectedOffice} employees`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong>{selectedOffice}</strong>
                  <button
                    onClick={() => { setSelectedOffice(null); setSelectedEmployees([]); }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                  color: "inherit"
                }}
                    aria-label="Close"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <ul className="list">
                  {selectedEmployees.map((name, i) => (
                    <li key={`${name}-${i}`} className="list-item">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          } catch {
            return null;
          }
        })(), document.body)
      : null}
    </>
  );
}
