import React, { useState } from "react";
import { FiX, FiPlus } from "react-icons/fi";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import ReactDOM from "react-dom";
import "../../styles/CreateTableModal.css"; // 新的 CSS 文件

function CreateTableModal({ isOpen, onClose, onTableCreated }) {
  const { theme } = useTheme();
  const { showSuccess, showError } = useNotification();
  const [tableName, setTableName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 基本验证
    if (!tableName.trim()) {
      setError("表格名称不能为空");
      return;
    }

    // 表名仅允许字母、数字、中文和下划线
    if (!/^[\w\u4e00-\u9fa5]+$/.test(tableName)) {
      setError("表格名称只能包含字母、数字、中文和下划线");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/create-table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          tableName,
          schema: [], // 创建空表格
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "创建表格失败");
      }

      showSuccess("表格创建成功");
      setTableName("");
      onTableCreated(); // 刷新表格列表
      onClose(); // 关闭对话框
    } catch (err) {
      console.error("创建表格失败:", err);
      setError(err.message || "创建表格失败");
      showError(`创建表格失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use a portal to render the modal at the document body level
  return ReactDOM.createPortal(
    <div className={`modal-overlay ${theme}-theme`}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>创建新表格</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="tableName">表格名称:</label>
              <input
                type="text"
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="请输入表格名称"
                autoFocus
                disabled={isSubmitting}
              />
              <small className="form-hint">
                表格名称只能包含字母、数字、中文和下划线
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  <span>创建中...</span>
                </>
              ) : (
                <>
                  <FiPlus />
                  <span>创建表格</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default CreateTableModal;
