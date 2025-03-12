import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { FiFile } from "react-icons/fi";
import "../styles/SideBar.css";

function Sidebar({ files, onFileSelect, selectedFile, collapsed, onToggle, isMobile }) {
  // 侧边栏是否完全隐藏（移动端折叠时）
  const isHidden = isMobile && collapsed;

  return (
    <AnimatePresence>
      {!isHidden && (
        <motion.div
          className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}
          initial={isMobile ? { x: "-100%" } : { width: collapsed ? 50 : 250 }}
          animate={isMobile ? { x: 0 } : { width: collapsed ? 50 : 250 }}
          exit={isMobile ? { x: "-100%" } : {}}
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
            {!isMobile && (
              <motion.button
                className="toggle-button"
                onClick={onToggle}
                aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
                animate={{
                  marginLeft: collapsed ? "auto" : 0,
                }}
                whileHover={{
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  scale: 1.1,
                }}
                initial={false}
              >
                {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
              </motion.button>
            )}
          </div>
          <div className="sidebar-content">
            <ul>
              {files.map((file, index) => (
                <li
                  key={index}
                  className={selectedFile === file ? "active" : ""}
                  onClick={() => {
                    onFileSelect(file);
                    // 在移动端选择文件后自动关闭侧边栏
                    if (isMobile) onToggle();
                  }}
                  title={file.replace(".json", "")}
                >
                  <span className="file-icon">
                    <FiFile />
                  </span>
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
          
          {isMobile && (
            <motion.button
              className="mobile-close"
              onClick={onToggle}
              whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
              whileTap={{ scale: 0.95 }}
            >
              <FiChevronLeft />
            </motion.button>
          )}
        </motion.div>
      )}
      
      {/* 移动端背景遮罩 */}
      {isMobile && !collapsed && (
        <motion.div 
          className="sidebar-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onToggle}
        />
      )}
    </AnimatePresence>
  );
}

export default Sidebar;