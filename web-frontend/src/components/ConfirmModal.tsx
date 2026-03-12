import React from "react";
import Modal from "./Modal";

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
        <p style={{ margin: 0 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              background: "#f1f5f9",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: "8px 12px",
              background: "#dc2626",
              color: "#ffffff",
              border: "1px solid #b91c1c",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
