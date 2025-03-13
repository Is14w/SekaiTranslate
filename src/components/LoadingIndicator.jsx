import React from "react";
import "../styles/LoadingIndicator.css";

const LoadingIndicator = ({ message = "加载中...", small = false }) => (
  <div className={`loading-indicator ${small ? "small" : ""}`}>
    <div className="loading-spinner"></div>
    {message && <div className="loading-message">{message}</div>}
  </div>
);

export default LoadingIndicator;
