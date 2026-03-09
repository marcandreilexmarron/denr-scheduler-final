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
      <div className="modal-card" style={{ display: "flex", flexDirection: "column", maxHeight: "90vh", width: "min(600px, 90vw)", position: "relative", overflowX: "hidden" }}>
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: 0,
            color: "inherit"
          }}
        >
          ×
        </button>
        <div style={{ minHeight: 0, overflowY: "auto", flex: "1 1 auto" }}>{children}</div>
      </div>
    </div>
  );
}
