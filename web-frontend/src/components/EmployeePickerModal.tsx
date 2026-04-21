import { useState, useMemo } from "react";
import Modal from "./Modal";

export default function EmployeePickerModal({
  open,
  officeName,
  choices,
  checked,
  onToggle,
  onConfirm,
  onClose
}: {
  open: boolean;
  officeName: string | null;
  choices: string[];
  checked: Record<string, boolean>;
  onToggle: (name: string, value: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChoices = useMemo(() => {
    if (!searchTerm) return choices;
    return choices.filter(choice =>
      choice.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [choices, searchTerm]);

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{officeName || "Office/Division"}</h3>
        <div style={{ color: "var(--muted)", fontSize: 13, marginTop: -4 }}>Pick employees to include in the event.</div>
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
        />
        <div className="hover-scroll" style={{ maxHeight: "min(40vh, 240px)", border: "1px solid var(--border)", borderRadius: 8, padding: 6 }}>
          {filteredChoices.map((n) => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!checked[n]}
                onChange={(e) => onToggle(n, e.target.checked)}
              />
              <span style={{ flex: 1 }}>{n}</span>
            </label>
          ))}
          {filteredChoices.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No employees available</div>}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button type="button" onClick={onConfirm} style={{ padding: "6px 12px", fontSize: 13 }}>Add Selected</button>
          <button type="button" style={{ background: "transparent", border: "1px solid var(--border)", color: "inherit", padding: "6px 12px", fontSize: 13 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
