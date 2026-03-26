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
      <div style={{ padding: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 16 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              background: "var(--secondary-bg)",
              color: "var(--secondary-color)",
              border: "1px solid var(--secondary-border)",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 500,
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
              padding: "6px 12px",
              background: "var(--error-color)",
              color: "var(--primary-contrast)",
              border: "1px solid var(--error-color)",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
