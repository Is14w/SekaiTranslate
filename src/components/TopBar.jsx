import React from "react";
import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa"; 
import { FiSettings, FiMenu } from "react-icons/fi";
import { BiLogIn } from "react-icons/bi";
import { BiUserPlus } from "react-icons/bi";
import "../styles/TopBar.css";

function TopBar({ isMobile, showSidebarToggle, sidebarCollapsed, onSidebarToggle }) {
  // GitHub repository URL
  const githubRepoUrl = "https://github.com/Is14w/SekaiTranslate";
  
  return (
    <motion.div 
      className={`topbar ${isMobile ? 'mobile' : ''}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="topbar-left">
        {showSidebarToggle && (
          <motion.button
            className="sidebar-toggle-btn"
            onClick={onSidebarToggle}
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
            whileTap={{ scale: 0.95 }}
          >
            <FiMenu />
          </motion.button>
        )}
        <div className="topbar-title">
          <h2>Sekai-Translate</h2>
        </div>
      </div>
      <div className="topbar-actions">
        <motion.a 
          className="action-button"
          href={githubRepoUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: isMobile ? 1 : 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          whileTap={{ scale: 0.95 }}
        >
          {!isMobile && <span className="button-text">访问源代码</span>}
          <FaGithub className="button-icon" />
        </motion.a>
        <motion.button 
          className="action-button"
          whileHover={{ scale: isMobile ? 1 : 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          whileTap={{ scale: 0.95 }}
        >
          {!isMobile && <span className="button-text">设置</span>}
          <FiSettings className="button-icon" />
        </motion.button>
        <motion.button 
          className="action-button"
          whileHover={{ scale: isMobile ? 1 : 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          whileTap={{ scale: 0.95 }}
        >
          {!isMobile && <span className="button-text">登录</span>}
          <BiLogIn className="button-icon" />
        </motion.button>
        <motion.button 
          className="action-button"
          whileHover={{ scale: isMobile ? 1 : 1.05, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          whileTap={{ scale: 0.95 }}
        >
          {!isMobile && <span className="button-text">注册</span>}
          <BiUserPlus className="button-icon" />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default TopBar;