import React from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import "./src/styles/Sidebar.css";

function Sidebar({ files, onFileSelect, selectedFile, collapsed, onToggle }) {
  // File icon mapping based on file extension
  const getFileIcon = (fileName) => {
    if (fileName.endsWith(".json")) {
      return "📄";
    }
    return "📁";
  };

  return (
    <motion.div
      className="sidebar"
      animate={{ width: collapsed ? 50 : 250 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="sidebar-header">
        <motion.h3
          animate={{
            opacity: collapsed ? 0 : 1,
            width: collapsed ? 0 : "auto",
          }}
          transition={{ duration: 0.2 }}
        >
          翻译表
        </motion.h3>
        {/* 确保按钮始终可点击 */}
        <motion.button
          className="toggle-button"
          onClick={onToggle}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          // 确保按钮不受折叠影响
          animate={{
            marginLeft: collapsed ? "auto" : 0,
          }}
          whileHover={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            scale: 1.1,
          }}
          initial={false}
        >
          {collapsed ? "►" : "◄"}
        </motion.button>
      </div>
      <div className="sidebar-content">
        <ul>
          {files.map((file, index) => (
            <li
              key={index}
              className={selectedFile === file ? "active" : ""}
              onClick={() => onFileSelect(file)}
              title={file.replace(".json", "")}
            >
              <span className="file-icon">{getFileIcon(file)}</span>
              <motion.span
                className="file-name"
                animate={{
                  opacity: collapsed ? 0 : 1,
                  width: collapsed ? 0 : "auto",
                }}
                transition={{ duration: 0.2 }}
              >
                {file.replace(".json", "")}
              </motion.span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default Sidebar;
