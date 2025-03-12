import React from 'react';
// eslint-disable-next-line
import { motion } from 'framer-motion';
import '../styles/FunctionPages.css';

function GlobalSearch() {
  return (
    <motion.div 
      className="function-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="function-page-header">
        <h2>全局检索</h2>
      </div>
      <div className="function-page-content">
        <p>全局检索功能将在此实现。</p>
        <p>您可以在这里搜索所有可用的翻译内容。</p>
      </div>
    </motion.div>
  );
}

export default GlobalSearch;