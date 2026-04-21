import React from "react";

export default function Modal({
  open,
  onClose,
  children,
  style
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden", ...style }}>
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
            color: "inherit",
            zIndex: 10
          }}
        >
          ×
        </button>
        <div style={{ minHeight: 0, overflowY: "auto", flex: "1 1 auto", padding: "0 8px" }}>{children}</div>
      </div>
    </div>
  );
}
