import React from 'react';
// eslint-disable-next-line
import { motion } from 'framer-motion';
import '../styles/NameSearch.css';

function NameSearch() {
  return (
    <motion.div 
      className="function-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="function-page-header">
        <h2>人名检索</h2>
      </div>
      <div className="function-page-content">
        <p>人名检索功能将在此实现。</p>
        <p>您可以在这里查找角色、人名相关的翻译。</p>
      </div>
    </motion.div>
  );
}

export default NameSearch;