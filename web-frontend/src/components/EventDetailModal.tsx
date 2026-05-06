import React from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { api, getApiBaseUrl } from "../api";
import { getToken } from "../auth";

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
  const [clickedRect, setClickedRect] = React.useState<DOMRect | null>(null);
  const [divisionOfficeNames, setDivisionOfficeNames] = React.useState<string[]>([]);
  const [officeServiceMap, setOfficeServiceMap] = React.useState<Record<string, string>>({});
  const [serviceOrder, setServiceOrder] = React.useState<string[]>([]);
  async function downloadWithAuth(pathOrUrl: string, filename: string) {
    const token = getToken();
    const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${getApiBaseUrl()}${pathOrUrl}`;
    const response = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ""
      }
    });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename || "attachment";
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  React.useEffect(() => {
    api.get("/api/offices-data")
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
  const [isPortrait, setIsPortrait] = React.useState(false);
  React.useEffect(() => {
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
      setClickedRect(null);
    }
  }, [open, event]);
  React.useEffect(() => {
    setSelectedOffice(null);
    setSelectedEmployees([]);
    setClickedRect(null);
  }, [event]);
  const handleClose = React.useCallback(() => {
    setSelectedOffice(null);
    setSelectedEmployees([]);
    setClickedRect(null);
    onClose();
  }, [onClose]);

  const modalBg = "var(--card)";
  const modalColor = "var(--text)";

  const subBorder = "1px solid var(--border)";

  return (
    <>
    <Modal open={open} onClose={handleClose} style={{ background: modalBg, color: modalColor, backdropFilter: "blur(14px)", border: `1px solid rgba(0,0,0,0.1)` }}>
      {event && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {event.category && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ ...categoryStyle(event.category), background: undefined, backgroundColor: categoryStyle(event.category)?.backgroundColor || "rgba(255,255,255,0.25)", border: `1px solid ${categoryStyle(event.category)?.borderColor || "rgba(0,0,0,0.05)"}`, fontSize: 13, padding: "4px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}>{event.category}</span>
                  {event.category === "others - specified" && event.categoryDetail && <span style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "inherit", border: "1px solid rgba(0,0,0,0.05)", fontSize: 13, padding: "4px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}>{event.categoryDetail}</span>}
                </div>
              )}
              <h2 style={{ margin: 0, fontSize: 22, opacity: 0.9 }}>{event.title}</h2>
              {(() => {
                const cat = String(event.category || "").trim().toLowerCase();
                if (cat === "workshop" || cat === "training") {
                  return <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, opacity: 0.8 }}>A report will be needed after the event.</div>;
                }
                return null;
              })()}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 16px", alignItems: "baseline", borderTop: subBorder, paddingTop: 14 }}>
            <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.95em", opacity: 0.7 }}>Date & time</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>
              {event.dateType === "range" && event.startDate && event.endDate
                ? `${formatFullDate(event.startDate)} ${formatTime(event.startTime)} → ${formatFullDate(event.endDate)} ${formatTime(event.endTime)}`
                : `${formatFullDate(event.date)} ${formatTime(event.startTime)}${event.endTime ? `–${formatTime(event.endTime)}` : ""}`}
            </div>
            {event.location && (
              <>
                <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.95em", opacity: 0.7 }}>Location</div>
                <div style={{ overflowWrap: "anywhere", fontSize: 15, opacity: 0.9 }}>{event.location}</div>
              </>
            )}
            <div style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.95em", opacity: 0.7 }}>From</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>{isPortrait ? abbreviateOffice(event.creatingOffice || event.office || "Unknown office") : (event.creatingOffice || event.office || "Unknown office")}</div>
          </div>
          {event.description && (
            <div style={{ borderTop: subBorder, paddingTop: 12 }}>
              <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13, opacity: 0.7 }}>Description</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.5, opacity: 0.9 }}>{event.description}</div>
            </div>
          )}
          {Array.isArray(event.participants) && event.participants.length > 0 && (() => {
            // ... (rest of the logic remains the same, but using subBorder and transparent badges)
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
              <div style={{ borderTop: subBorder, paddingTop: 12 }}>
                <div style={{ marginBottom: 6, color: "var(--muted)", fontSize: 13, opacity: 0.7 }}>Participants</div>
                {hasAllDivisionOffices && (
                  <div style={{ marginBottom: 6 }}>
                    <span
                      className="badge"
                      style={{ position: "relative", display: "inline-flex", alignItems: "center", fontSize: 13, padding: "4px 10px", background: "rgba(255,255,255,0.25)", border: "1px solid rgba(0,0,0,0.05)", backdropFilter: "blur(4px)" }}
                    >
                      Division Chiefs
                    </span>
                  </div>
                )}
                {(serviceOrder.length ? serviceOrder : Object.keys(groups)).map((svc) => {
                  const g = groups[svc];
                  if (!g || (g.collapsed.length === 0 && g.singles.length === 0 && g.officeOnly.length === 0 && g.others.length === 0)) return null;
                  return (
                    <div key={`svc-${svc}`} style={{ marginBottom: 10 }}>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 4, fontWeight: 500, opacity: 0.7 }}>{svc}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%" }}>
                        {g.collapsed.map(([off, emps]) => (
                          <span
                            key={`off-${svc}-${off}`}
                            className="badge"
                            style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", fontSize: 13, padding: "4px 10px", background: "rgba(255,255,255,0.25)", color: "inherit", border: "1px solid rgba(0,0,0,0.05)", backdropFilter: "blur(4px)" }}
                            onClick={(e) => {
                              setClickedRect(e.currentTarget.getBoundingClientRect());
                              setSelectedOffice(off);
                              setSelectedEmployees(emps);
                            }}
                          >
                            {off}
                            <span
                              aria-hidden
                              style={{
                                marginLeft: 6,
                                fontSize: 11,
                                opacity: 0.85,
                                padding: "0 6px",
                                border: "1px solid rgba(0,0,0,0.1)",
                                borderRadius: 999,
                                lineHeight: "16px",
                                background: "rgba(255,255,255,0.3)",
                                color: "inherit"
                              }}
                            >
                              +{emps.length}
                            </span>
                          </span>
                        ))}
                        {g.singles.map((p, idx) => (
                          <span key={`sg-${svc}-${idx}`} className="badge" style={{ fontSize: 13, padding: "4px 10px", background: "rgba(255,255,255,0.25)", color: "inherit", border: "1px solid rgba(0,0,0,0.05)", backdropFilter: "blur(4px)" }}>{p}</span>
                        ))}
                        {g.officeOnly.map((p, idx) => (
                          <span key={`oo-${svc}-${idx}`} className="badge" style={{ fontSize: 13, padding: "4px 10px", background: "rgba(255,255,255,0.25)", color: "inherit", border: "1px solid rgba(0,0,0,0.05)", backdropFilter: "blur(4px)" }}>{p}</span>
                        ))}
                        {g.others.map((p, idx) => (
                          <span key={`ot-${svc}-${idx}`} className="badge" style={{ fontSize: 13, padding: "4px 10px", background: "rgba(255,255,255,0.25)", color: "inherit", border: "1px solid rgba(0,0,0,0.05)", backdropFilter: "blur(4px)" }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {Array.isArray(event.attachments) && event.attachments.length > 0 && (
            <div style={{ marginTop: 12, borderTop: subBorder, paddingTop: 12 }}>
              <strong style={{ fontSize: 14, opacity: 0.8 }}>Attachments:</strong>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 4 }}>
                {event.attachments.map((att: any, idx: number) => {
                  const hasBlob = typeof att?.blob === "string" && !!att.blob;
                  const hasUploadsUrl = typeof att?.url === "string" && att.url.startsWith("/uploads/");
                  return (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      {hasBlob ? (
                        <a
                          href={att.blob}
                          download={att.name || "attachment"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--blue-color)", textDecoration: "underline", cursor: "pointer", fontSize: 14, opacity: 0.9 }}
                        >
                          {att.name || "Attachment"}
                        </a>
                      ) : hasUploadsUrl ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await downloadWithAuth(att.url, String(att.name || "attachment"));
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Failed to download attachment");
                            }
                          }}
                          style={{ background: "transparent", border: "none", padding: 0, margin: 0, color: "var(--blue-color)", textDecoration: "underline", cursor: "pointer", fontSize: 14, opacity: 0.9 }}
                        >
                          {att.name || "Attachment"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 13, opacity: 0.75 }}>{att.name || "Attachment"}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {canEditEvent && canEditEvent(event) && onEdit && (
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: subBorder, paddingTop: 12, gridColumn: "1 / 2" }}>
              <button
                onClick={() => onEdit(event)}
                style={{
                  padding: "8px 14px",
                  background: "var(--primary)",
                  color: "var(--primary-contrast)",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: 0.85
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
    {open && selectedOffice && selectedEmployees.length > 0 && clickedRect
      ? createPortal((() => {
          try {
            const panelWidth = Math.min(280, window.innerWidth - 32);
            const gap = 4;
            let left = clickedRect.left;
            let top = clickedRect.bottom + gap;
            
            if (left + panelWidth > window.innerWidth - 16) {
              left = window.innerWidth - panelWidth - 16;
            }
            if (left < 16) left = 16;

            let finalMaxHeight = Math.min(300, window.innerHeight - top - 16);
            
            // If it would be too small below, and there is more room above, flip it
            if (finalMaxHeight < 120 && clickedRect.top > window.innerHeight - clickedRect.bottom) {
              const aboveSpace = clickedRect.top - 16 - gap;
              finalMaxHeight = Math.min(300, aboveSpace);
              top = clickedRect.top - finalMaxHeight - gap;
            }

            return (
              <div
                style={{
                  position: "fixed",
                  zIndex: 1100,
                  top,
                  left,
                  width: panelWidth,
                  maxHeight: finalMaxHeight,
                  overflow: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--card)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  animation: "fadeIn 0.2s ease-out"
                }}
                role="dialog"
                aria-label={`${selectedOffice} employees`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{selectedOffice}</strong>
                  <button
                    onClick={() => { setSelectedOffice(null); setSelectedEmployees([]); setClickedRect(null); }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                  color: "inherit",
                  opacity: 0.6
                }}
                    aria-label="Close"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <ul
                  className="list"
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6
                  }}
                >
                  {selectedEmployees.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      style={{ margin: 0, padding: 0, border: "none", background: "transparent" }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: "var(--secondary-bg)",
                          color: "var(--secondary-color)",
                          fontSize: 12,
                          lineHeight: "16px",
                          whiteSpace: "nowrap"
                        }}
                        title={name}
                      >
                        {name}
                      </span>
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
