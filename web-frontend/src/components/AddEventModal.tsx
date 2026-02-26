import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import EmployeePickerModal from "./EmployeePickerModal";

function normalizeCategory(s: string) {
  return String(s || "").trim().toLowerCase();
}

export default function AddEventModal({
  open,
  onClose,
  defaultDate,
  categories,
  availableOffices,
  onSubmit,
  officesData,
  mode,
  initialEvent,
  submitLabel,
  title
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  categories: string[];
  availableOffices: string[];
  onSubmit: (payload: {
    category: string;
    categoryDetail?: string;
    type: "Internal" | "External";
    title: string;
    description?: string;
    location?: string;
    dateType: "single" | "range";
    date: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    participants: string[];
    office: string | null;
    attachments?: any[];
    participantTokens?: string[];
  }) => void;
  officesData?: { topLevelOffices: Array<{ name: string }>; services: Array<{ name: string; offices: Array<{ name: string }> }> };
  mode?: "add" | "edit";
  initialEvent?: any | null;
  submitLabel?: string;
  title?: string;
}) {
  const [employeesData, setEmployeesData] = useState<{ byOffice: Record<string, string[]> } | null>(null);
  const [state, setState] = useState<any>({
    category: "meeting",
    categoryDetail: "",
    type: "Internal",
    title: "",
    description: "",
    location: "",
    dateType: "single",
    date: defaultDate,
    startDate: defaultDate,
    endDate: defaultDate,
    startTime: "",
    endTime: "",
    participants: [],
    office: null,
    attachments: [],
    _participantInput: ""
  });
  const isEdit = (mode ?? "add") === "edit";
  const isRange = state.dateType === "range";
  const titleError = String(state.title || "").trim() ? null : "Title is required";
  const dateRangeError = isRange && state.startDate && state.endDate && state.endDate < state.startDate ? "End date must be on or after start date" : null;
  const timeRangeError = state.startTime && state.endTime && state.endTime <= state.startTime ? "End time must be after start time" : null;
  const isValid = !titleError && !dateRangeError && !timeRangeError;
  const [employeeModalOffice, setEmployeeModalOffice] = useState<string | null>(null);
  const [employeeChoices, setEmployeeChoices] = useState<string[]>([]);
  const [employeeChecked, setEmployeeChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const url = `/api/employees?v=${Date.now()}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEmployeesData(d))
      .catch(() => setEmployeesData({ byOffice: {} }));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (initialEvent && isEdit) {
      const ev = initialEvent;
      const isR = String(ev?.dateType || "single") === "range";
      let participantsFromEvent: string[] = Array.isArray(ev.participants) ? [...ev.participants] : [];
      // If this event recorded the special token "Division Chiefs", collapse any expanded division offices back to the token for editing
      if (Array.isArray(ev.participantTokens) && ev.participantTokens.includes("Division Chiefs") && officesData) {
        const divisionOffices = officesData.services.flatMap((svc) => svc.offices.map((o) => o.name));
        participantsFromEvent = participantsFromEvent.filter((p) => !divisionOffices.includes(p));
        if (!participantsFromEvent.includes("Division Chiefs")) {
          participantsFromEvent.push("Division Chiefs");
        }
      }
      setState({
        category: ev.category || "meeting",
        categoryDetail: ev.categoryDetail || "",
        type: ev.type || "Internal",
        title: ev.title || "",
        description: ev.description || "",
        location: ev.location || "",
        dateType: isR ? "range" : "single",
        date: isR ? "" : (ev.date || defaultDate),
        startDate: isR ? (ev.startDate || defaultDate) : defaultDate,
        endDate: isR ? (ev.endDate || ev.startDate || defaultDate) : defaultDate,
        startTime: ev.startTime || "",
        endTime: ev.endTime || "",
        participants: participantsFromEvent,
        office: ev.office ?? null,
        attachments: Array.isArray(ev.attachments) ? ev.attachments : [],
        _participantInput: ""
      });
    } else {
      setState({
        category: "meeting",
        categoryDetail: "",
        type: "Internal",
        title: "",
        description: "",
        location: "",
        dateType: "single",
        date: defaultDate,
        startDate: defaultDate,
        endDate: defaultDate,
        startTime: "",
        endTime: "",
        participants: [],
        office: null,
        attachments: [],
        _participantInput: ""
      });
    }
  }, [open, initialEvent, isEdit, defaultDate, officesData]);
  function getEmployeesForOffice(officeName: string) {
    const known = new Set<string>([
      ...(availableOffices || []),
      ...(officesData ? officesData.topLevelOffices.map(o => o.name) : []),
      ...(officesData ? officesData.services.flatMap(s => s.offices.map(o => o.name)) : [])
    ]);
    if (!known.has(officeName)) {
      return [];
    }
    return employeesData?.byOffice?.[officeName] ?? [];
  }
  function openEmployeePicker(officeName: string) {
    const list = getEmployeesForOffice(officeName);
    const checked: Record<string, boolean> = {};
    for (const e of list) checked[e] = (state.participants || []).includes(`${e} — ${officeName}`) || (state.participants || []).includes(e);
    setEmployeeChoices(list);
    setEmployeeChecked(checked);
    setEmployeeModalOffice(officeName);
  }
  function applyEmployeeSelection() {
    if (!employeeModalOffice) {
      setEmployeeModalOffice(null);
      return;
    }
    const chosen = employeeChoices.filter((n) => employeeChecked[n]);
    const formatted = chosen.map((n) => `${n} — ${employeeModalOffice}`);
    const next = Array.from(new Set([...(state.participants || []), ...formatted]));
    setState({ ...state, participants: next });
    setEmployeeModalOffice(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    let participants: string[] = Array.isArray(state.participants) ? [...state.participants] : [];
    participants = Array.from(new Set(participants));
    // Capture high-level participant tokens before expansion
    const participantTokens: string[] = [];
    if (participants.includes("Division Chiefs")) {
      participantTokens.push("Division Chiefs");
    }
    if (participants.includes("Division Chiefs") && officesData) {
      participants = participants.filter((x) => x !== "Division Chiefs");
      const divisionOffices = officesData.services.flatMap((svc) => svc.offices.map((o) => o.name));
      const set = new Set<string>(participants);
      for (const name of divisionOffices) set.add(name);
      participants = Array.from(set);
    }
    const payload = {
      category: state.category,
      categoryDetail: normalizeCategory(state.category) === "others - specified" ? (state.categoryDetail || "") : undefined,
      type: state.type || "Internal",
      title: state.title,
      description: state.description || "",
      location: state.location,
      dateType: isRange ? "range" as const : "single" as const,
      date: isRange ? "" : state.date,
      startDate: isRange ? (state.startDate || defaultDate) : "",
      endDate: isRange ? (state.endDate || defaultDate) : "",
      startTime: state.startTime,
      endTime: state.endTime,
      participants,
      office: state.office,
      participantTokens: participantTokens.length ? participantTokens : undefined
    };
    onSubmit(payload);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12, maxWidth: 720 }}>
        <h2 style={{ margin: "0 0 4px 0" }}>{title ?? (isEdit ? "Edit Event" : "New Event")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Category</label>
            <select
              style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
              value={state.category}
              onChange={(e) => setState({ ...state, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Type</label>
            <select
              style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
              value={state.type}
              onChange={(e) => setState({ ...state, type: e.target.value })}
            >
              <option value="Internal">Internal</option>
              <option value="External">External</option>
            </select>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Details</div>
        {normalizeCategory(state.category) === "others - specified" && (
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Specify Category</label>
            <input
              style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
              placeholder="Specify category"
              value={state.categoryDetail || ""}
              onChange={(e) => setState({ ...state, categoryDetail: e.target.value })}
            />
          </div>
        )}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Event Title</label>
          <input
            style={{ width: "100%", padding: 10, border: `1px solid ${titleError ? "#dc2626" : "var(--border)"}`, borderRadius: 8, background: "var(--card)", fontSize: 14 }}
            placeholder="Title"
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            autoFocus
          />
          {titleError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{titleError}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Description</label>
          <textarea
            rows={3}
            style={{ width: "100%", resize: "vertical", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
            placeholder="What is this event about?"
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Location</label>
          <input
            style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
            placeholder="Venue or meeting link"
            value={state.location}
            onChange={(e) => setState({ ...state, location: e.target.value })}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Schedule</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                checked={state.dateType !== "range"}
                onChange={() => setState({ ...state, dateType: "single" })}
              />
              <span>Single Date</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                checked={state.dateType === "range"}
                onChange={() => setState({ ...state, dateType: "range", startDate: defaultDate, endDate: defaultDate })}
              />
              <span>Date Range</span>
            </label>
          </div>
          {state.dateType === "range" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Start Date</label>
                <input
                  type="date"
                  style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
                  value={state.startDate}
                  onChange={(e) => setState({ ...state, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>End Date</label>
                <input
                  type="date"
                  min={state.startDate || undefined}
                  style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
                  value={state.endDate}
                  onChange={(e) => setState({ ...state, endDate: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Date</label>
              <input
                type="date"
                style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }}
                value={state.date}
                onChange={(e) => setState({ ...state, date: e.target.value })}
              />
            </div>
          )}
          {dateRangeError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{dateRangeError}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Start Time</label>
            <input type="time" style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }} value={state.startTime} onChange={(e) => setState({ ...state, startTime: e.target.value })} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>End Time</label>
            <input type="time" style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 14 }} value={state.endTime} onChange={(e) => setState({ ...state, endTime: e.target.value })} />
          </div>
        </div>
        {timeRangeError && <div style={{ color: "#dc2626", fontSize: 12, marginTop: -2 }}>{timeRangeError}</div>}
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Participants</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {officesData ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Top-level Offices</div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 6, maxHeight: 140, overflowY: "auto" }}>
                    {officesData.topLevelOffices.map((o) => {
                      const name = o.name;
                      const checked = Array.isArray(state.participants) && state.participants.includes(name);
                      return (
                        <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12, marginBottom: 6 }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(ev) => {
                                if (ev.target.checked) {
                                  const next = Array.isArray(state.participants) ? [...state.participants, name] : [name];
                                  setState({ ...state, participants: next });
                                } else {
                                  const next = (state.participants || []).filter((x: string) => x !== name);
                                  setState({ ...state, participants: next });
                                }
                              }}
                            />
                            <span
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEmployeePicker(name); }}
                              role="button"
                              style={{ padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
                              title="Select Employees"
                            >
                              {name}
                            </span>
                          </label>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Division Chiefs", "Committee"].map((g) => {
                    const checked = Array.isArray(state.participants) && state.participants.includes(g);
                    return (
                      <label key={g} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(ev) => {
                            if (ev.target.checked) {
                              const next = Array.isArray(state.participants) ? [...state.participants, g] : [g];
                              setState({ ...state, participants: next });
                            } else {
                              const next = (state.participants || []).filter((x: string) => x !== g);
                              setState({ ...state, participants: next });
                            }
                          }}
                        />
                        <span>{g}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {officesData.services.map((svc) => (
                    <div key={svc.name}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{svc.name}</div>
                      <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 6, maxHeight: 160, overflowY: "auto" }}>
                        {svc.offices.map((o) => {
                          const name = o.name;
                          const checked = Array.isArray(state.participants) && state.participants.includes(name);
                          return (
                            <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12, marginBottom: 6 }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(ev) => {
                                    if (ev.target.checked) {
                                      const next = Array.isArray(state.participants) ? [...state.participants, name] : [name];
                                      setState({ ...state, participants: next });
                                    } else {
                                      const next = (state.participants || []).filter((x: string) => x !== name);
                                      setState({ ...state, participants: next });
                                    }
                                  }}
                                />
                                <span
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEmployeePicker(name); }}
                                  role="button"
                                  style={{ padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
                                  title="Select Employees"
                                >
                                  {name}
                                </span>
                              </label>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 6, maxHeight: 140, overflowY: "auto" }}>
                {availableOffices.map((o) => {
                  const checked = Array.isArray(state.participants) && state.participants.includes(o);
                  return (
                    <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12, marginBottom: 6 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(ev) => {
                            if (ev.target.checked) {
                              const next = Array.isArray(state.participants) ? [...state.participants, o] : [o];
                              setState({ ...state, participants: next });
                            } else {
                              const next = (state.participants || []).filter((x: string) => x !== o);
                              setState({ ...state, participants: next });
                            }
                          }}
                        />
                        <span
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEmployeePicker(o); }}
                          role="button"
                          style={{ padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}
                          title="Select Employees"
                        >
                          {o}
                        </span>
                      </label>
                    </span>
                  );
                })}
              </div>
            )}
            {Array.isArray(state.participants) && state.participants.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {state.participants.map((p: string, idx: number) => (
                  <span key={`${p}-${idx}`} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {p}
                    <button type="button" onClick={() => setState({ ...state, participants: state.participants.filter((x: string) => x !== p) })} aria-label={`Remove ${p}`} title={`Remove ${p}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <EmployeePickerModal
          open={!!employeeModalOffice}
          officeName={employeeModalOffice}
          choices={employeeChoices}
          checked={employeeChecked}
          onToggle={(name, val) => setEmployeeChecked({ ...employeeChecked, [name]: val })}
          onConfirm={applyEmployeeSelection}
          onClose={() => setEmployeeModalOffice(null)}
        />
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Attachments</div>
          <input
            type="file"
            multiple
            style={{ width: "100%" }}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              setState({ ...state, attachments: files });
            }}
          />
          {Array.isArray(state.attachments) && state.attachments.length > 0 && (
            <ul className="list" style={{ marginTop: 6 }}>
              {state.attachments.map((f: any, idx: number) => (
                <li key={idx} className="list-item">{f.name || String(f)}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              padding: "10px 12px",
              background: "#2563eb",
              color: "#ffffff",
              border: "1px solid #1d4ed8",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              opacity: isValid ? 1 : 0.6
            }}
            disabled={!isValid}
          >
            {submitLabel ?? (isEdit ? "Save" : "Create")}
          </button>
          <button
            type="button"
            style={{ padding: "10px 12px", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
