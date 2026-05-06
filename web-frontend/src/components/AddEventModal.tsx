import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { api, getApiBaseUrl } from "../api";
import { getToken } from "../auth";
import EmployeePickerModal from "./EmployeePickerModal";

function normalizeCategory(s: string) {
  return String(s || "").trim().toLowerCase();
}

type TimeParts = { hour: string; minute: string; ampm: string };
const DEFAULT_TIME_PARTS: TimeParts = { hour: "", minute: "00", ampm: "AM" };
const REFER_TO_ATTACHMENTS_TEXT = "Refer to attachments.";
function parseTimeToParts(time24: any): TimeParts {
  const s = String(time24 ?? "").trim();
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return DEFAULT_TIME_PARTS;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return DEFAULT_TIME_PARTS;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return DEFAULT_TIME_PARTS;
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return { hour: String(h12).padStart(2, "0"), minute: String(mm).padStart(2, "0"), ampm };
}
function partsToTime24(parts: TimeParts): string {
  const h = Number(parts.hour);
  const m = Number(parts.minute);
  const ap = String(parts.ampm || "").toUpperCase();
  if (!Number.isInteger(h) || h < 1 || h > 12) return "";
  if (!Number.isInteger(m) || m < 0 || m > 59) return "";
  if (ap !== "AM" && ap !== "PM") return "";
  const hh = ap === "AM" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function AddEventModal({
  open,
  onClose,
  defaultDate,
  defaultDateType,
  defaultStartDate,
  defaultEndDate,
  categories,
  availableOffices,
  onSubmit,
  officesData,
  mode,
  initialEvent,
  submitLabel,
  title,
  variant
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultDateType?: "single" | "range";
  defaultStartDate?: string;
  defaultEndDate?: string;
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
  variant?: "modal" | "page";
}) {
  const isPage = (variant ?? "modal") === "page";
  const isOpen = isPage ? true : open;
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
  const [employeesData, setEmployeesData] = useState<{ byOffice: Record<string, string[]> } | null>(null);
  const [holidays, setHolidays] = useState<Array<{ month: number; day: number; name: string }>>([]);
  const [state, setState] = useState<any>({
    category: "",
    categoryDetail: "",
    type: "Internal",
    title: "",
    description: "",
    location: "",
    referToAttachments: false,
    dateType: (defaultDateType ?? "single"),
    date: defaultDate,
    startDate: (defaultStartDate ?? defaultDate),
    endDate: (defaultEndDate ?? defaultDate),
    startTime: "",
    endTime: "",
    participants: [],
    office: null,
    attachments: [],
    _participantInput: ""
  });
  const [startTimeParts, setStartTimeParts] = useState<TimeParts>(() => parseTimeToParts(""));
  const [endTimeParts, setEndTimeParts] = useState<TimeParts>(() => parseTimeToParts(""));
  const isEdit = (mode ?? "add") === "edit";
  const isRange = state.dateType === "range";
  const titleError = String(state.title || "").trim() ? null : "Title is required";
  const categoryError = state.category ? null : "Category is required";
  const typeError = state.type ? null : "Type is required";
  const dateRequiredError = !isRange && !String(state.date || "").trim() ? "Date is required" : null;
  const startDateRequiredError = isRange && !String(state.startDate || "").trim() ? "Start date is required" : null;
  const endDateRequiredError = isRange && !String(state.endDate || "").trim() ? "End date is required" : null;
  const dateRangeError = isRange && state.startDate && state.endDate && state.endDate < state.startDate ? "End date must be on or after start date" : null;
  const startTimeRequiredError = !String(state.startTime || "").trim() ? "Start time is required" : null;
  const endTimeRequiredError = !String(state.endTime || "").trim() ? "End time is required" : null;
  const timeRangeError = state.startTime && state.endTime && state.endTime <= state.startTime ? "End time must be after start time" : null;
  const participantsError =
    Array.isArray(state.participants) && state.participants.length > 0 ? null : "Participants is required";
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  })();
  function isHolidayDate(s?: string) {
    if (!s) return false;
    const [y, m, d] = s.split("-").map(Number);
    if (!m || !d) return false;
    return holidays.some((h) => h.month === m && h.day === d);
  }
  const pastSingleError = state.dateType !== "range" && state.date && state.date < today ? "Date must be today or later" : null;
  const holidaySingleError = state.dateType !== "range" && isHolidayDate(state.date) ? "Selected date is a holiday" : null;
  const startPastError = state.dateType === "range" && state.startDate && state.startDate < today ? "Start date must be today or later" : null;
  // For ranges, holidays will be automatically skipped; do not error on holiday starts/ends
  const scheduleErrors = [dateRequiredError, startDateRequiredError, endDateRequiredError, pastSingleError, holidaySingleError, startPastError].filter(Boolean) as string[];
  const holidaysNote = state.dateType === "range" ? "Holidays within the range will be excluded" : "";
  const isValidSchedule = scheduleErrors.length === 0 && !dateRangeError;
  const isValid =
    !titleError &&
    !categoryError &&
    !typeError &&
    isValidSchedule &&
    !startTimeRequiredError &&
    !endTimeRequiredError &&
    !timeRangeError &&
    !participantsError;
  const [employeeModalOffice, setEmployeeModalOffice] = useState<string | null>(null);
  const [employeeChoices, setEmployeeChoices] = useState<string[]>([]);
  const [employeeChecked, setEmployeeChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setStartTimeParts(parseTimeToParts(state.startTime));
  }, [state.startTime]);
  useEffect(() => {
    setEndTimeParts(parseTimeToParts(state.endTime));
  }, [state.endTime]);

  useEffect(() => {
    if (!isOpen) return;
    api.get(`/api/employees?v=${Date.now()}`)
      .then((d) => {
        // Transform array of employees into { byOffice: { "OfficeName": ["Emp1", "Emp2"] } }
        if (Array.isArray(d)) {
          const byOffice: Record<string, string[]> = {};
          d.forEach((emp: any) => {
            const office = emp.officeName || "Other";
            if (!byOffice[office]) byOffice[office] = [];
            byOffice[office].push(emp.name);
          });
          // Sort names in each office
          Object.keys(byOffice).forEach(k => byOffice[k].sort());
          setEmployeesData({ byOffice });
        } else {
          
          setEmployeesData(d);
        }
      })
      .catch(() => setEmployeesData({ byOffice: {} }));
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    api.get("/api/holidays")
      .then((d) => Array.isArray(d) ? setHolidays(d) : setHolidays([]))
      .catch(() => setHolidays([]));
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    if (initialEvent && isEdit) {
      const ev = initialEvent;
      const isR = String(ev?.dateType || "single") === "range";
      let participantsFromEvent: string[] = Array.isArray(ev.participants) ? [...ev.participants] : [];
      const tokensFromEvent: string[] = Array.isArray(ev.participantTokens) ? ev.participantTokens : [];
      const referDetails =
        !!(ev as any).referToAttachments ||
        String(ev?.description || "").trim().toLowerCase() === REFER_TO_ATTACHMENTS_TEXT.toLowerCase() ||
        String(ev?.location || "").trim().toLowerCase() === REFER_TO_ATTACHMENTS_TEXT.toLowerCase();
      const hasReferParticipantToken = tokensFromEvent.some((t) => String(t).trim().toLowerCase() === "refer to attachments");

      const formatDateForInput = (isoDate: string) => {
        if (!isoDate) return '';
        try {
          const d = new Date(isoDate);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${dd}`;
        } catch {
          return '';
        }
      };

      // If this event recorded the special token "Division Chiefs", collapse any expanded division offices back to the token for editing
      if (Array.isArray(ev.participantTokens) && ev.participantTokens.includes("Division Chiefs") && officesData) {
        const divisionOffices = officesData.services.flatMap((svc) => svc.offices.map((o) => o.name));
        participantsFromEvent = participantsFromEvent.filter((p) => !divisionOffices.includes(p));
        if (!participantsFromEvent.includes("Division Chiefs")) {
          participantsFromEvent.push("Division Chiefs");
        }
      }
      if (hasReferParticipantToken && !participantsFromEvent.includes("Refer to attachments")) {
        participantsFromEvent.push("Refer to attachments");
      }
      setState({
        category: ev.category || "meeting",
        categoryDetail: ev.categoryDetail || "",
        type: ev.type || "Internal",
        title: ev.title || "",
        description: ev.description || "",
        location: ev.location || "",
        referToAttachments: referDetails,
        dateType: isR ? "range" : "single",
        date: !isR && ev.date ? formatDateForInput(ev.date) : defaultDate,
        startDate: isR && ev.startDate ? formatDateForInput(ev.startDate) : defaultDate,
        endDate: isR && ev.endDate ? formatDateForInput(ev.endDate) : (isR && ev.startDate ? formatDateForInput(ev.startDate) : defaultDate),
        startTime: ev.startTime || "",
        endTime: ev.endTime || "",
        participants: participantsFromEvent,
        office: ev.office ?? null,
        attachments: Array.isArray(ev.attachments) ? ev.attachments : [],
        _participantInput: ""
      });
    } else {
      setState({
        category: "",
        categoryDetail: "",
        type: "Internal",
        title: "",
        description: "",
        location: "",
        referToAttachments: false,
        dateType: (defaultDateType ?? "single"),
        date: defaultDate,
        startDate: (defaultStartDate ?? defaultDate),
        endDate: (defaultEndDate ?? defaultDate),
        startTime: "",
        endTime: "",
        participants: [],
        office: null,
        attachments: [],
        _participantInput: ""
      });
    }
  }, [isOpen, initialEvent, isEdit, defaultDate, defaultDateType, defaultStartDate, defaultEndDate, officesData]);
  function getEmployeesForOffice(officeName: string) {
    
    // Normalize helper
    const norm = (s: string) => s.trim().toLowerCase();
    
    // Try exact match first
    if (employeesData?.byOffice?.[officeName]) {
      return employeesData.byOffice[officeName];
    }
    
    // Try case-insensitive match
    const target = norm(officeName);
    const foundKey = Object.keys(employeesData?.byOffice || {}).find(k => norm(k) === target);
    if (foundKey) {
      return employeesData?.byOffice?.[foundKey] || [];
    }

    return [];
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function uploadFile(file: File) {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const response = await fetch(`${getApiBaseUrl()}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : ""
      },
      body: fd
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err?.message || `Upload failed (${response.status})`);
    }
    return response.json();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const uploadedAttachments = [];
      if (Array.isArray(state.attachments) && state.attachments.length > 0) {
        for (const file of state.attachments) {
          if (file instanceof File) {
            try {
              const up = await uploadFile(file);
              uploadedAttachments.push(up);
            } catch (err) {
              console.error(`Failed to upload file ${file.name}:`, err);
            }
          } else {
            uploadedAttachments.push(file);
          }
        }
      }

      let participants: string[] = Array.isArray(state.participants) ? [...state.participants] : [];
      participants = Array.from(new Set(participants));
      // Capture high-level participant tokens before expansion
      const participantTokens: string[] = [];
      const referToken = participants.some((p) => String(p).trim().toLowerCase() === "refer to attachments");
      if (referToken) {
        participantTokens.push("Refer to attachments");
        participants = participants.filter((p) => String(p).trim().toLowerCase() !== "refer to attachments");
      }
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
        description: state.referToAttachments ? REFER_TO_ATTACHMENTS_TEXT : (state.description || ""),
        location: state.referToAttachments ? REFER_TO_ATTACHMENTS_TEXT : state.location,
        dateType: isRange ? "range" as const : "single" as const,
        date: isRange ? "" : state.date,
        startDate: isRange ? (state.startDate || defaultDate) : "",
        endDate: isRange ? (state.endDate || defaultDate) : "",
        startTime: state.startTime,
        endTime: state.endTime,
        participants,
        office: state.office,
        attachments: uploadedAttachments,
        participantTokens: participantTokens.length ? participantTokens : undefined
      };
      await onSubmit(payload);
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formEl = (
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8, width: "100%" }}>
        <h2 style={{ margin: "0 0 0 0", fontSize: 18 }}>{title ?? (isEdit ? "Edit Event" : "New Event")}</h2>
        {isPage && !isEdit && (
          <div style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 6px 0" }}>
            Fill the details to schedule an event.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 180px", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
              Category <span style={{ color: "var(--error-color)" }}>*</span>
            </label>
            <select
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 8,
                paddingRight: 32,
                border: `1px solid ${categoryError ? "var(--error-color)" : "var(--border)"}`,
                borderRadius: 8,
                background: "var(--card)",
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "1.2em",
                appearance: "none",
                fontSize: 13,
                color: state.category === "" ? "var(--muted)" : "inherit"
              }}
              value={state.category}
              onChange={(e) => setState({ ...state, category: e.target.value })}
            >
              <option value="" disabled>Select Category</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {categoryError && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 2 }}>{categoryError}</div>}
            {(normalizeCategory(state.category) === "workshop" || normalizeCategory(state.category) === "training") && (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>A report will be needed after the event.</div>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
              Type <span style={{ color: "var(--error-color)" }}>*</span>
            </label>
            <select
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 8,
                paddingRight: 32,
                border: `1px solid ${typeError ? "var(--error-color)" : "var(--border)"}`,
                borderRadius: 8,
                background: "var(--card)",
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "1.2em",
                appearance: "none",
                fontSize: 13,
                color: state.type === "" ? "var(--muted)" : "inherit"
              }}
              value={state.type}
              onChange={(e) => setState({ ...state, type: e.target.value })}
            >
              <option value="" disabled>Select Type</option>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
            </select>
            {typeError && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 2 }}>{typeError}</div>}
          </div>
        </div>
        {normalizeCategory(state.category) === "others - specified" && (
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Specify Category</label>
            <input
              style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 13 }}
              placeholder="Specify category"
              value={state.categoryDetail || ""}
              onChange={(e) => setState({ ...state, categoryDetail: e.target.value })}
            />
          </div>
        )}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
            Event Title <span style={{ color: "var(--error-color)" }}>*</span>
          </label>
          <input
            style={{ width: "100%", boxSizing: "border-box", padding: 8, border: `1px solid ${titleError ? "var(--error-color)" : "var(--border)"}`, borderRadius: 8, background: "var(--card)", fontSize: 13 }}
            placeholder="Title"
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            autoFocus
          />
          {titleError && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 2 }}>{titleError}</div>}
        </div>
        <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12, background: "var(--secondary-bg)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Details</div>
          <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Description</label>
              <textarea
                rows={2}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 13 }}
                placeholder="What is this event about?"
                value={state.description}
                disabled={!!state.referToAttachments}
                onChange={(e) => setState({ ...state, description: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Location</label>
              <input
                style={{ width: "100%", boxSizing: "border-box", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", fontSize: 13 }}
                placeholder="Venue or meeting link"
                value={state.location}
                disabled={!!state.referToAttachments}
                onChange={(e) => setState({ ...state, location: e.target.value })}
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={!!state.referToAttachments}
              onChange={(e) => {
                const checked = e.target.checked;
                const desc = String(state.description || "").trim();
                const loc = String(state.location || "").trim();
                if (checked) {
                  setState({ ...state, referToAttachments: true, description: REFER_TO_ATTACHMENTS_TEXT, location: REFER_TO_ATTACHMENTS_TEXT });
                  return;
                }
                setState({
                  ...state,
                  referToAttachments: false,
                  description: desc.toLowerCase() === REFER_TO_ATTACHMENTS_TEXT.toLowerCase() ? "" : state.description,
                  location: loc.toLowerCase() === REFER_TO_ATTACHMENTS_TEXT.toLowerCase() ? "" : state.location
                });
              }}
            />
            Refer to attachments
          </label>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            Schedule <span style={{ color: "var(--error-color)" }}>*</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
              <input
                type="radio"
                checked={state.dateType !== "range"}
                onChange={() => setState({ ...state, dateType: "single" })}
              />
              <span>Single Date</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
              <input
                type="radio"
                checked={state.dateType === "range"}
                onChange={() => setState({ ...state, dateType: "range", startDate: defaultDate, endDate: defaultDate })}
              />
              <span>Date Range</span>
            </label>
          </div>
          {state.dateType === "range" ? (
            <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                  Start Date <span style={{ color: "var(--error-color)" }}>*</span>
                </label>
                <input
                  type="date"
                  style={{ width: "100%", boxSizing: "border-box", padding: 8, border: `1px solid ${startDateRequiredError || startPastError ? "var(--error-color)" : "var(--border)"}`, borderRadius: 8, background: "var(--card)", fontSize: 13 }}
                  min={today}
                  value={state.startDate}
                  onChange={(e) => setState({ ...state, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                  End Date <span style={{ color: "var(--error-color)" }}>*</span>
                </label>
                <input
                  type="date"
                  min={state.startDate || undefined}
                  style={{ width: "100%", boxSizing: "border-box", padding: 8, border: `1px solid ${endDateRequiredError || dateRangeError ? "var(--error-color)" : "var(--border)"}`, borderRadius: 8, background: "var(--card)", fontSize: 13 }}
                  value={state.endDate}
                  onChange={(e) => setState({ ...state, endDate: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                Date <span style={{ color: "var(--error-color)" }}>*</span>
              </label>
              <input
                type="date"
                style={{ width: "100%", boxSizing: "border-box", padding: 8, border: `1px solid ${dateRequiredError || scheduleErrors.length > 0 ? "var(--error-color)" : "var(--border)"}`, borderRadius: 8, background: "var(--card)", fontSize: 13 }}
                min={today}
                value={state.date}
                onChange={(e) => setState({ ...state, date: e.target.value })}
              />
            </div>
          )}
          {(dateRangeError || scheduleErrors.length > 0) && (
            <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: 4 }}>
              {dateRangeError || scheduleErrors.join(". ")}
            </div>
          )}
          {isValidSchedule && holidaysNote && (
            <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{holidaysNote}</div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
              Start Time <span style={{ color: "var(--error-color)" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "64px 14px 64px 80px", gap: 6, marginBottom: 4, color: "var(--muted)", fontSize: 11 }}>
              <div style={{ textAlign: "center" }}>Hour</div>
              <div />
              <div style={{ textAlign: "center" }}>Minute</div>
              <div style={{ textAlign: "center" }}>AM/PM</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 12,
                border: `1px solid ${startTimeRequiredError ? "var(--error-color)" : "var(--border)"}`,
                background: "var(--card)",
                color: "var(--text)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"
              }}
            >
              <select
                aria-label="Start time hour"
                value={startTimeParts.hour}
                onChange={(e) => {
                  const hour = e.target.value;
                  setStartTimeParts((prev) => {
                    const next = { ...prev, hour };
                    setState((s: any) => ({ ...s, startTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 64,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                  <option key={`sh-${h}`} value={h}>{h}</option>
                ))}
              </select>
              <span style={{ fontSize: 18, fontWeight: 900, color: "var(--muted)" }}>:</span>
              <select
                aria-label="Start time minute"
                value={startTimeParts.minute}
                onChange={(e) => {
                  const minute = e.target.value;
                  setStartTimeParts((prev) => {
                    const next = { ...prev, minute };
                    setState((s: any) => ({ ...s, startTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 64,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                  <option key={`sm-${m}`} value={m}>{m}</option>
                ))}
              </select>
              <select
                aria-label="Start time AM or PM"
                value={startTimeParts.ampm}
                onChange={(e) => {
                  const ampm = e.target.value;
                  setStartTimeParts((prev) => {
                    const next = { ...prev, ampm };
                    setState((s: any) => ({ ...s, startTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 80,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 16,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
              End Time <span style={{ color: "var(--error-color)" }}>*</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "64px 14px 64px 80px", gap: 6, marginBottom: 4, color: "var(--muted)", fontSize: 11 }}>
              <div style={{ textAlign: "center" }}>Hour</div>
              <div />
              <div style={{ textAlign: "center" }}>Minute</div>
              <div style={{ textAlign: "center" }}>AM/PM</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 12,
                border: `1px solid ${endTimeRequiredError || timeRangeError ? "var(--error-color)" : "var(--border)"}`,
                background: "var(--card)",
                color: "var(--text)",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"
              }}
            >
              <select
                aria-label="End time hour"
                value={endTimeParts.hour}
                onChange={(e) => {
                  const hour = e.target.value;
                  setEndTimeParts((prev) => {
                    const next = { ...prev, hour };
                    setState((s: any) => ({ ...s, endTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 64,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                  <option key={`eh-${h}`} value={h}>{h}</option>
                ))}
              </select>
              <span style={{ fontSize: 18, fontWeight: 900, color: "var(--muted)" }}>:</span>
              <select
                aria-label="End time minute"
                value={endTimeParts.minute}
                onChange={(e) => {
                  const minute = e.target.value;
                  setEndTimeParts((prev) => {
                    const next = { ...prev, minute };
                    setState((s: any) => ({ ...s, endTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 64,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                  <option key={`em-${m}`} value={m}>{m}</option>
                ))}
              </select>
              <select
                aria-label="End time AM or PM"
                value={endTimeParts.ampm}
                onChange={(e) => {
                  const ampm = e.target.value;
                  setEndTimeParts((prev) => {
                    const next = { ...prev, ampm };
                    setState((s: any) => ({ ...s, endTime: partsToTime24(next) }));
                    return next;
                  });
                }}
                style={{
                  width: 80,
                  height: 36,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--secondary-bg)",
                  color: "inherit",
                  fontSize: 16,
                  fontWeight: 800,
                  padding: "0 8px",
                  textAlign: "center",
                  textAlignLast: "center",
                  appearance: "none",
                  WebkitAppearance: "none"
                }}
              >
                <option value="">--</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>
        {(startTimeRequiredError || endTimeRequiredError || timeRangeError) && (
          <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: -2 }}>
            {timeRangeError || startTimeRequiredError || endTimeRequiredError}
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            Participants <span style={{ color: "var(--error-color)" }}>*</span>
          </div>
          {participantsError && <div style={{ color: "var(--error-color)", fontSize: 11, marginTop: -2, marginBottom: 6 }}>{participantsError}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
            {officesData ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    const g = "Refer to attachments";
                    const checked = Array.isArray(state.participants) && state.participants.includes(g);
                    return (
                      <label key={g} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, fontWeight: 700, maxWidth: "100%" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(ev) => {
                            if (ev.target.checked) {
                              const next = Array.isArray(state.participants) ? [...state.participants, g] : [g];
                              setState({
                                ...state,
                                participants: next
                              });
                            } else {
                              const next = (state.participants || []).filter((x: string) => x !== g);
                              setState({
                                ...state,
                                participants: next
                              });
                            }
                          }}
                        />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span>{g}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", lineHeight: 1.25 }}>
                            Select this when there are too many individuals to list—still select the offices these individuals are under.
                          </span>
                        </span>
                      </label>
                    );
                  })()}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Top-level Offices</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, border: "1px solid var(--border)", borderRadius: 6, padding: 4, maxHeight: 100, overflowY: "auto" }}>
                    {officesData.topLevelOffices.map((o) => {
                      const name = o.name;
                      const checked = Array.isArray(state.participants) && state.participants.includes(name);
                      return (
                        <label key={name} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
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
                            style={{ flex: 1, padding: "1px 6px", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", whiteSpace: "normal", wordBreak: "break-word", fontSize: 12 }}
                            title={name}
                          >
                            {name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Division Chiefs", "Committee"].map((g) => {
                    const checked = Array.isArray(state.participants) && state.participants.includes(g);
                    return (
                      <label key={g} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: isPortrait ? "1fr" : "1fr 1fr", gap: 8 }}>
                  {officesData.services.map((svc) => (
                    <div key={svc.name}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{svc.name}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, border: "1px solid var(--border)", borderRadius: 6, padding: 4, maxHeight: 100, overflowY: "auto" }}>
                        {svc.offices.map((o) => {
                          const name = o.name;
                          const checked = Array.isArray(state.participants) && state.participants.includes(name);
                          return (
                            <label key={name} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
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
                                style={{ flex: 1, padding: "1px 6px", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", whiteSpace: "normal", wordBreak: "break-word", fontSize: 12 }}
                                title={name}
                              >
                                {name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 4, maxHeight: 120, overflowY: "auto" }}>
                {availableOffices.map((o) => {
                  const checked = Array.isArray(state.participants) && state.participants.includes(o);
                  return (
                    <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10, marginBottom: 4 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
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
                          style={{ padding: "1px 6px", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}
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
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {state.participants.map((p: string, idx: number) => (
                  <span key={`${p}-${idx}`} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 6px" }}>
                    {p}
                    <button
                      type="button"
                      onClick={() => setState({ ...state, participants: state.participants.filter((x: string) => x !== p) })}
                      aria-label={`Remove ${p}`}
                      title={`Remove ${p}`}
                      style={{ fontSize: 14, background: "transparent", border: "none", color: "inherit", padding: 0, lineHeight: 1, cursor: "pointer" }}
                    >
                      ×
                    </button>
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
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Attachments</div>
          <input
            type="file"
            multiple
            style={{ width: "100%", fontSize: 12 }}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              setState({ ...state, attachments: files });
            }}
          />
          {Array.isArray(state.attachments) && state.attachments.length > 0 && (
            <ul className="list" style={{ marginTop: 4 }}>
              {state.attachments.map((f: any, idx: number) => (
                <li key={idx} className="list-item" style={{ fontSize: 12, padding: "4px 8px" }}>{f.name || String(f)}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <button
            type="submit"
            style={{
              padding: "8px 10px",
              background: "var(--primary)",
              color: "var(--primary-contrast)",
              border: "1px solid var(--primary)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              opacity: isValid ? 1 : 0.6
            }}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : (submitLabel ?? (isEdit ? "Save" : "Create"))}
          </button>
          <button
            type="button"
            style={{ padding: "8px 10px", background: "var(--secondary-bg)", color: "var(--secondary-color)", border: "1px solid var(--secondary-border)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
  );
  if (isPage) {
    return (
      <div style={{ padding: 12 }}>
        {formEl}
      </div>
    );
  }
  return (
    <Modal open={open} onClose={onClose}>
      {formEl}
    </Modal>
  );
}
