import React from "react";
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
  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Select employees — {officeName || ""}</h3>
        <div className="hover-scroll" style={{ maxHeight: "min(40vh, 280px)", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
          {choices.map((n) => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <input
                type="checkbox"
                checked={!!checked[n]}
                onChange={(e) => onToggle(n, e.target.checked)}
              />
              <span style={{ flex: 1 }}>{n}</span>
            </label>
          ))}
          {choices.length === 0 && <div style={{ color: "var(--muted)" }}>No employees available</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={onConfirm}>Add Selected</button>
          <button type="button" style={{ background: "transparent", border: "1px solid var(--border)", color: "inherit" }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
