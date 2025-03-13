import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiUsers,
  FiBook,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiFile,
} from "react-icons/fi";
import "../styles/FunctionSidebar.css";

function FunctionSidebar({
  selectedFunction,
  onFunctionSelect,
  collapsed,
  onToggle,
  isMobile,
  jsonFiles,
  selectedFile,
  onFileSelect,
}) {
  // 可用功能列表
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
    },
  ];

  // 追踪哪些菜单被展开
  const [expandedMenus, setExpandedMenus] = useState(["translation-tables"]);

  // 切换子菜单展开/折叠
  const toggleSubMenu = (menuId) => {
    setExpandedMenus((prevState) =>
      prevState.includes(menuId)
        ? prevState.filter((id) => id !== menuId)
        : [...prevState, menuId]
    );
  };

  // 检查一个菜单是否展开
  const isMenuExpanded = (menuId) => expandedMenus.includes(menuId);

  const handleFunctionItemClick = (funcId, hasSubItems) => {
    onFunctionSelect(funcId);

    if (hasSubItems) {
      toggleSubMenu(funcId);
    }
  };

  return (
    <div className={`function-sidebar-container ${isMobile ? "mobile" : ""}`}>
      <motion.div
        className={`function-sidebar ${collapsed ? "collapsed" : ""} ${
          isMobile ? "mobile" : ""
        }`}
        initial={false}
        animate={{
          width: !isMobile ? (collapsed ? 50 : 250) : 250,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="function-sidebar-header">
          <motion.h3
            animate={{
              opacity: collapsed && !isMobile ? 0 : 1,
              width: collapsed && !isMobile ? 0 : "auto",
            }}
            transition={{ duration: 0.2 }}
          >
            功能列表
          </motion.h3>
          <motion.button
            className="toggle-button"
            onClick={onToggle}
            aria-label={collapsed ? "展开功能栏" : "收起功能栏"}
            whileHover={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              scale: 1.1,
            }}
          >
            {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </motion.button>
        </div>

        <div className="function-sidebar-content">
          <ul className="function-list">
            {functions.map((func) => (
              <React.Fragment key={func.id}>
                <motion.li
                  className={`function-item ${
                    selectedFunction === func.id ? "active" : ""
                  } ${
                    func.hasSubItems && isMenuExpanded(func.id)
                      ? "expanded"
                      : ""
                  }`}
                  data-function-id={func.id}
                  onClick={() =>
                    handleFunctionItemClick(func.id, func.hasSubItems)
                  }
                  title={func.name}
                  whileHover={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                  }}
                  whileTap={{ scale: 0.98 }}
                  animate={{
                    backgroundColor:
                      selectedFunction === func.id
                        ? "rgba(97, 218, 251, 0.1)"
                        : "transparent",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="function-icon">{func.icon}</span>
                  <motion.span
                    className="function-name"
                    animate={{
                      opacity: collapsed && !isMobile ? 0 : 1,
                      width: collapsed && !isMobile ? 0 : "auto",
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {func.name}
                  </motion.span>
                  {func.hasSubItems && (!collapsed || isMobile) && (
                    <motion.span
                      className="submenu-toggle"
                      animate={{ rotate: isMenuExpanded(func.id) ? 180 : 0 }}
                    >
                      <FiChevronDown />
                    </motion.span>
                  )}
                </motion.li>

                {/* 子菜单 - 翻译表文件列表 */}
                <AnimatePresence>
                  {func.id === "translation-tables" &&
                    isMenuExpanded(func.id) &&
                    (!collapsed || isMobile) && (
                      <motion.div
                        className="submenu"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ul className="file-list">
                          {jsonFiles.map((file) => (
                            <li
                              key={file}
                              className={`file-item ${
                                selectedFile === file ? "active" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileSelect(file);
                                if (selectedFunction !== "translation-tables") {
                                  onFunctionSelect("translation-tables");
                                }
                              }}
                            >
                              <span className="file-icon">
                                <FiFile />
                              </span>
                              <span className="file-name">{file.replace(/\.json$/, '')}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
}

export default FunctionSidebar;
