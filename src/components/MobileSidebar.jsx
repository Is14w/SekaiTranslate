import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBook, FiSearch, FiUsers } from "react-icons/fi"; // 添加图标导入
import "../styles/MobileSidebar.css";

const MobileSidebar = ({
  isOpen,
  onClose,
  selectedFunction,
  selectedFile,
  onFunctionSelect,
  onFileSelect,
  expandedMenus,
  onToggleMenu,
  jsonFiles, // 新增 jsonFiles 参数
}) => {
  // 将functions定义移到组件内部
  const functions = [
    {
      id: "translation-tables",
      name: "翻译表",
      icon: <FiBook />,
      hasSubItems: true,
      files: jsonFiles,
    },
    {
      id: "global-search",
      name: "全局检索",
      icon: <FiSearch />,
      hasSubItems: false,
    },
    {
      id: "name-search",
      name: "人名检索",
      icon: <FiUsers />,
      hasSubItems: false,
    },
  ];

  return (
    <>
      <div
        className={`mobile-backdrop ${isOpen ? "visible" : ""}`}
        onClick={onClose}
      />
      <div className={`mobile-sidebar ${isOpen ? "open" : ""}`}>
        <div className="mobile-sidebar-content">
          <ul className="mobile-menu-list">
            {functions.map((func) => (
              <li key={func.id}>
                <motion.div
                  className={`mobile-menu-item ${
                    selectedFunction === func.id ? "active" : ""
                  }`}
                  onClick={() => {
                    onFunctionSelect(func.id);
                    if (!func.hasSubItems) {
                      onClose();
                    }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="mobile-menu-icon">{func.icon}</span>
                  <span>{func.name}</span>
                  {func.hasSubItems && (
                    <span
                      className="mobile-menu-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu(func.id);
                      }}
                    >
                      {expandedMenus.includes(func.id) ? "▼" : "▶"}
                    </span>
                  )}
                </motion.div>
                {func.hasSubItems && (
                  <div
                    className={`mobile-submenu ${
                      expandedMenus.includes(func.id) ? "expanded" : ""
                    }`}
                  >
                    <ul className="mobile-file-list">
                      {func.files?.map((file) => (
                        <motion.li
                          key={file}
                          className={`mobile-file-item ${
                            selectedFile === file ? "active" : ""
                          }`}
                          onClick={() => {
                            onFileSelect(file);
                            onClose();
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {file}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default MobileSidebar;
