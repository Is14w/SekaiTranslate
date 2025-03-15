import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBook,
  FiSearch,
  FiUsers,
  FiFile,
  FiChevronDown,
} from "react-icons/fi";
import "../styles/MobileSidebar.css";
import { useTheme } from "../contexts/ThemeContext";

const MobileSidebar = ({
  isOpen,
  onClose,
  selectedFunction,
  selectedFile,
  onFunctionSelect,
  onFileSelect,
  expandedMenus,
  onToggleMenu,
  jsonFiles,
}) => {
  // 使用主题上下文
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // 将functions定义移到组件内部
  const functions = [
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
    {
      id: "translation-tables",
      name: "翻译表",
      icon: <FiBook />,
      hasSubItems: true,
      files: jsonFiles,
    },
  ];

  // 主题相关颜色配置
  const getActiveBackgroundColor = () => {
    return isDarkMode ? "rgba(97, 218, 251, 0.1)" : "rgba(3, 102, 214, 0.1)";
  };

  return (
    <>
      <div
        className={`mobile-backdrop ${isOpen ? "visible" : ""}`}
        onClick={onClose}
      />
      <div
        className={`mobile-sidebar ${isOpen ? "open" : ""} ${theme}-theme`}
        data-current-function={selectedFunction}
      >
        <div className="mobile-sidebar-content">
          <ul className="mobile-menu-list">
            {functions.map((func) => (
              <li key={func.id}>
                <motion.div
                  className={`mobile-menu-item ${
                    selectedFunction === func.id ? "active" : ""
                  } ${
                    func.hasSubItems && expandedMenus.includes(func.id)
                      ? "expanded"
                      : ""
                  }`}
                  data-function-id={func.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFunctionSelect(func.id);
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="mobile-menu-icon">{func.icon}</span>
                  <span className="mobile-menu-name">{func.name}</span>
                  {func.hasSubItems && (
                    <motion.span
                      className="mobile-submenu-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu(func.id);
                      }}
                      animate={{
                        rotate: expandedMenus.includes(func.id) ? 180 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronDown />
                    </motion.span>
                  )}
                </motion.div>
                {func.hasSubItems && (
                  <AnimatePresence>
                    {expandedMenus.includes(func.id) && (
                      <motion.div
                        className="mobile-submenu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
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
                                if (selectedFunction !== "translation-tables") {
                                  onFunctionSelect("translation-tables");
                                }
                                onClose();
                              }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <span className="mobile-file-icon">
                                <FiFile />
                              </span>
                              <span className="mobile-file-name">
                                {file.replace(/\.json$/, "")}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
