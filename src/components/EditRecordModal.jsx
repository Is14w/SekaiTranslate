import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useTheme } from "../contexts/ThemeContext.jsx";

function EditRecordModal({ isOpen, onClose, record, columns, onSave, isNew }) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (record) {
      setFormData({ ...record });
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    // Add validation rules if needed
    // Example: Required fields
    columns.forEach((column) => {
      // Skip ID field
      if (column === "id") return;

      // Optional: Add specific validation rules for certain fields
      // For this example, we're keeping it simple
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <div className={`edit-modal-overlay ${theme}-theme`}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <h3 className="edit-modal-title">
            {isNew ? "添加新记录" : "编辑记录"}
          </h3>
          <button className="edit-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="edit-modal-body">
          <form className="edit-modal-form" onSubmit={handleSubmit}>
            {columns.map(
              (column) =>
                // Skip rendering input for ID field
                column !== "id" && (
                  <div className="form-field" key={column}>
                    <label className="form-label">{column}</label>
                    {column.includes("备注") || column.includes("说明") ? (
                      <textarea
                        className="form-textarea"
                        name={column}
                        value={formData[column] || ""}
                        onChange={handleChange}
                        placeholder={`输入${column}...`}
                      />
                    ) : (
                      <input
                        className="form-input"
                        name={column}
                        value={formData[column] || ""}
                        onChange={handleChange}
                        placeholder={`输入${column}...`}
                      />
                    )}
                    {errors[column] && (
                      <div className="error-message">{errors[column]}</div>
                    )}
                  </div>
                )
            )}
          </form>
        </div>

        <div className="edit-modal-footer">
          <button
            type="button"
            className="modal-button cancel-button"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="modal-button save-button"
            onClick={handleSubmit}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditRecordModal;
