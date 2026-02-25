import React from "react";

export default function Modal({
  open,
  onClose,
  children
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, flex: "0 0 auto" }}>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{ minHeight: 0, overflowY: "auto", flex: "1 1 auto" }}>{children}</div>
      </div>
    </div>
  );
}
