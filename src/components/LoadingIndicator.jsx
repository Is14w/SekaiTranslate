import React from "react";
import { motion } from "framer-motion";
import "../styles/LoadingIndicator.css";

const LoadingIndicator = ({ message = "加载中..." }) => {
  return (
    <div className="loading-container">
      <motion.div
        className="loading-spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingIndicator;
