import React, { useEffect, useMemo, useState } from "react";
import AddEventModal from "../components/AddEventModal";
import { getToken } from "../auth";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";

export default function AddEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [officesData, setOfficesData] = useState<{ topLevelOffices: any[]; services: any[] } | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    api.get("/api/offices-data")
      .then((d) => setOfficesData(d));
  }, []);
  const availableOffices = useMemo(() => {
    if (!officesData) return [] as string[];
    return [
      ...officesData.topLevelOffices.map((o: any) => o.name),
      ...officesData.services.flatMap((s: any) => s.offices.map((o: any) => o.name))
    ];
  }, [officesData]);
  const CATEGORY_OPTIONS = ["workshop", "meeting", "training", "conference", "travel", "activity", "others - specified"];
  function getDefaultDateFromQuery() {
    try {
      const params = new URLSearchParams(location.search);
      const q = params.get("date");
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    } catch {}
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  const defaultDate = getDefaultDateFromQuery();
  function getRangeFromQuery(): { start?: string; end?: string } {
    try {
      const params = new URLSearchParams(location.search);
      const s = params.get("start") || undefined;
      const e = params.get("end") || undefined;
      if (s && e && /^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(e)) {
        return { start: s, end: e };
      }
    } catch {}
    return {};
  }
  const range = getRangeFromQuery();
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

  return (
    <div style={{ padding: isPortrait ? 8 : 16 }}>
      <div className="card hover-scroll" style={{ padding: isPortrait ? 8 : 12, maxWidth: 900, margin: "0 auto", width: "100%", boxSizing: "border-box", borderTop: "4px solid var(--primary)" }}>
        {success && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              border: "1px solid #86efac",
              background: "#dcfce7",
              color: "#166534",
              borderRadius: 8,
              fontWeight: 600
            }}
          >
            {success}
          </div>
        )}
        <AddEventModal
          key={resetCounter}
          variant="page"
          open={true}
          onClose={() => navigate("/office-dashboard")}
          defaultDate={defaultDate}
          defaultDateType={range.start && range.end ? "range" : "single"}
          defaultStartDate={range.start}
          defaultEndDate={range.end}
          categories={CATEGORY_OPTIONS}
          availableOffices={availableOffices}
          officesData={officesData ?? undefined}
          onSubmit={(payload) => {
            api.post("/api/events", payload)
              .then(() => {
                setSuccess(`Event "${payload.title}" scheduled successfully!`);
                setResetCounter((c) => c + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => setSuccess(null), 5000);
              })
              .catch((err) => {
                console.error("Failed to create event:", err);
                alert("Failed to create event");
              });
          }}
        />
      </div>
    </div>
  );
}
