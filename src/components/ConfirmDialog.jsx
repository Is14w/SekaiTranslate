import React from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className={`confirm-dialog-overlay ${theme}-theme`}>
      <div className="confirm-dialog">
        <div className="confirm-dialog-header">
          <h3 className="confirm-dialog-title">{title}</h3>
        </div>

        <div className="confirm-dialog-body">
          <p>{message}</p>
        </div>

        <div className="confirm-dialog-footer">
          <button className="confirm-cancel-button" onClick={onClose}>
            取消
          </button>
          <button className="confirm-delete-button" onClick={onConfirm}>
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
