import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import JsonTable from "./components/JsonTable";
import TopBar from "./components/TopBar";
import "./App.css";

function App() {
  // State for storing all JSON file names
  const [jsonFiles, setJsonFiles] = useState([]);
  // State for storing the currently selected JSON data
  const [currentJsonData, setCurrentJsonData] = useState(null);
  // Currently selected file name
  const [selectedFile, setSelectedFile] = useState("");
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  // Error state
  const [error, setError] = useState(null);
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile view state
  const [isMobile, setIsMobile] = useState(false);

  // 使用防抖动函数处理窗口大小变化
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // 防抖动处理窗口大小变化
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkIfMobile = useCallback(
    debounce(() => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 只有第一次加载时才自动折叠侧边栏，避免切换尺寸时自动触发
      if (mobile && !isMobile) {
        setSidebarCollapsed(true);
      }
    }, 250),
    []
  );

  // 检查屏幕尺寸
  useEffect(() => {
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, [checkIfMobile]);

  // Use Vite's import.meta.glob to find all JSON files in the assets directory
  useEffect(() => {
    async function loadJsonFiles() {
      try {
        // For Vite, this finds all JSON files at build time
        const jsonModules = import.meta.glob("/public/assets/*.json");
        const fileNames = Object.keys(jsonModules).map((path) => {
          // Extract just the filename from the path
          const parts = path.split("/");
          return parts[parts.length - 1];
        });

        console.log("Available JSON files:", fileNames);
        setJsonFiles(fileNames);

        // Load the first file by default
        if (fileNames.length > 0) {
          handleFileSelect(fileNames[0]);
        }
      } catch (error) {
        console.error("Error loading file list:", error);
        setError(`Failed to find JSON files: ${error.message}`);
      }
    }

    loadJsonFiles();
  }, []);

  const handleFileSelect = async (fileName) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Loading file: ${fileName}`);
      const response = await fetch(`/assets/${fileName}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("JSON data loaded:", data);
      setCurrentJsonData(data);
      setSelectedFile(fileName);

      // Auto-collapse sidebar after file selection on mobile
      if (isMobile) {
        setSidebarCollapsed(true);
      }
    } catch (error) {
      console.error("Error loading JSON file:", error);
      setError(`Failed to load file: ${error.message}`);
      setCurrentJsonData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sidebar collapse toggle
  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={`app-container ${isMobile ? "mobile-view" : ""}`}>
      <TopBar
        isMobile={isMobile}
        showSidebarToggle={isMobile}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={handleSidebarToggle}
      />
      <div className="main-content">
        <Sidebar
          files={jsonFiles}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          collapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          isMobile={isMobile}
        />
        <div
          className={`content-area ${
            sidebarCollapsed ? "sidebar-collapsed" : ""
          }`}
        >
          {isLoading ? (
            <div className="loading">正在加载...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <JsonTable data={currentJsonData} isMobile={isMobile} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
