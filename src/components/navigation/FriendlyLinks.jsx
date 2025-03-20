import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiExternalLink, FiChevronDown, FiLink } from "react-icons/fi";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import "../../styles/FriendlyLinks.css";

function FriendlyLinks({ collapsed }) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const links = [
    {
      name: "Sekai Text 翻译校对应用",
      url: "https://github.com/Sutedako/PRSK_Editor",
      description: "Git链接，应用本体在群文件",
    },
    {
      name: "Sekai Tools 轴机兼翻译校对工具",
      url: "https://github.com/Icexbb/SekaiTools/releases/latest",
      description: "",
    },
    {
      name: "Sekai Text Web",
      url: "https://icexbb.github.io/SekaiTextWeb",
      description: "",
    },
    {
      name: "中日辞典",
      url: "https://cjjc.weblio.jp/",
      description: "",
    },
    {
      name: "日语辞典",
      url: "https://www.weblio.jp/",
      description: "",
    },
    {
      name: "年轻人日语辞典",
      url: "https://numan.tokyo/words/",
      description: "",
    },
    {
      name: "中文反向词典",
      url: "https://wantwords.net/",
      description: "找近义词等",
    },
    {
      name: "拟声词网站①",
      url: "https://nihongokyoshi-net.com/onomatopoeia/",
      description: "",
    },
    {
      name: "拟声词网站②",
      url: "https://goiryoku.com/onomatopoeia/",
      description: "",
    },
  ];

  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`friendly-links-container ${theme}-theme ${
        collapsed ? "collapsed" : ""
      }`}
    >
      <div className="friendly-links-header" onClick={toggleExpand}>
        <div className="friendly-links-title">
          <FiLink className="friendly-links-icon" />
          {!collapsed && <span>友情链接</span>}
        </div>
        {!collapsed && (
          <motion.div
            className="friendly-links-toggle"
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <FiChevronDown />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && !collapsed && (
          <motion.div
            className="friendly-links-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ul className="friendly-links-list">
              {links.map((link, index) => (
                <li key={index} className="friendly-link-item">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={
                      link.description
                        ? `${link.name} - ${link.description}`
                        : link.name
                    }
                  >
                    <span className="friendly-link-name">{link.name}</span>
                    <FiExternalLink className="friendly-link-external" />
                  </a>
                  {link.description && (
                    <span className="friendly-link-description">
                      {link.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FriendlyLinks;
