import { useState, useEffect } from "react";
import JsonTable from "./components/JsonTable";
import TopBar from "./components/TopBar";
import FunctionSidebar from "./components/FunctionSidebar";
import GlobalSearch from "./components/GlobalSearch";
import NameSearch from "./components/NameSearch";
import MobileSidebar from "./components/MobileSidebar";
import { isJsonCached, getJsonFromCache, cacheJson } from "./utils/JsonCache";
import "./App.css";

function App() {
  // State for storing all JSON file names
  const [jsonFiles, setJsonFiles] = useState([]);
  // Currently selected function
  const [selectedFunction, setSelectedFunction] = useState("");
  // Currently selected file name
  const [selectedFile, setSelectedFile] = useState("");
  // State for storing the currently selected JSON data
  const [currentJsonData, setCurrentJsonData] = useState(null);
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  // Error state
  const [error, setError] = useState(null);
  // Sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile view state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedMenus, setExpandedMenus] = useState(["translation-tables"]);

  const handleToggleMenu = (menuId) => {
    setExpandedMenus((prevState) =>
      prevState.includes(menuId)
        ? prevState.filter((id) => id !== menuId)
        : [...prevState, menuId]
    );
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;

      // 只在状态变化时更新，避免不必要的重渲染
      if (mobile !== isMobile) {
        setIsMobile(mobile);

        if (mobile && !isMobile) {
          setSidebarCollapsed(true);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    // 初始化时确保执行一次
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  // 加载 JSON 文件列表
  useEffect(() => {
    async function loadJsonFiles() {
      try {
        const jsonModules = import.meta.glob("/public/assets/*.json");
        const fileNames = Object.keys(jsonModules).map((path) => {
          const parts = path.split("/");
          return parts[parts.length - 1];
        });

        console.log("Available JSON files:", fileNames);
        setJsonFiles(fileNames);

        if (
          fileNames.length > 0 &&
          !selectedFile &&
          (selectedFunction === "" ||
            selectedFunction === "translation-tables") &&
          !currentJsonData
        ) {
          console.log("Initial load - selecting first file");
          handleFileSelect(fileNames[0]);
        }

        if (fileNames.length > 0) {
          const filesToPreload = fileNames.slice(0, 3);

          if ("requestIdleCallback" in window) {
            filesToPreload.forEach((file, index) => {
              setTimeout(() => {
                window.requestIdleCallback(() => {
                  if (!isJsonCached(file)) {
                    console.log(`Preloading: ${file}`);
                    fetch(`/assets/${file}`)
                      .then((response) => response.json())
                      .then((data) => {
                        cacheJson(file, data);
                        console.log(`Preloaded: ${file}`);
                      })
                      .catch((err) =>
                        console.warn(`Failed to preload ${file}`, err)
                      );
                  }
                });
              }, index * 2000);
            });
          }
        }
      } catch (error) {
        console.error("Error loading file list:", error);
        setError(`Failed to find JSON files: ${error.message}`);
      }
    }

    loadJsonFiles();
  }, [selectedFunction, selectedFile, currentJsonData]); // 添加currentJsonData作为依赖

  const handleFileSelect = async (fileName) => {
    setIsLoading(true);
    setError(null);
    setSelectedFunction("translation-tables"); // 确保选择文件时设置正确的功能

    try {
      console.log(`Loading file: ${fileName}`);

      if (isJsonCached(fileName)) {
        console.log(`Loading ${fileName} from cache`);
        const cachedData = getJsonFromCache(fileName);
        setCurrentJsonData(cachedData);
        setSelectedFile(fileName);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/assets/${fileName}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("JSON data loaded:", data);
      cacheJson(fileName, data);
      setCurrentJsonData(data);
      setSelectedFile(fileName);

      // 移动端下选择文件后自动折叠侧边栏
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

  const handleFunctionSelect = (functionId) => {
    setSelectedFunction(functionId);

    // 当选择翻译表时的处理逻辑
    if (functionId === "translation-tables") {
      // 如果没有选中文件，则选择第一个文件
      if (!selectedFile && jsonFiles.length > 0) {
        console.log("No file selected, selecting first file");
        handleFileSelect(jsonFiles[0]);
      }
      // 如果有选中文件但没有数据，则加载该文件
      else if (selectedFile && !currentJsonData) {
        console.log(
          `File selected (${selectedFile}) but no data, loading file`
        );
        handleFileSelect(selectedFile);
      }
      // 否则，保持当前状态，不做任何操作
    }

    // 移动端下选择功能后自动折叠侧边栏
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  };

  // 处理侧边栏折叠切换
  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  // 渲染内容区域
  const renderContent = () => {
    if (selectedFunction === "global-search") {
      return <GlobalSearch />;
    } else if (selectedFunction === "name-search") {
      return <NameSearch />;
    } else if (selectedFunction === "translation-tables") {
      return isLoading ? (
        <div className="loading">加载中...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <JsonTable data={currentJsonData} isMobile={isMobile} />
      );
    } else {
      // 如果没有选择任何功能，显示欢迎页面
      return (
        <div className="welcome-page">
          <h2>欢迎使用 Sekai Translate</h2>
          <p>请从左侧选择一个功能开始使用。</p>
        </div>
      );
    }
  };

  return (
    <div className={`app-container ${isMobile ? "mobile-view" : ""}`}>
      <TopBar isMobile={isMobile} onToggleSidebar={handleSidebarToggle} />

      {isMobile && !sidebarCollapsed && (
        <div
          className="sidebar-overlay active"
          onClick={handleSidebarToggle}
          aria-hidden="true"
          style={{ zIndex: 500 }} // 添加内联样式确保z-index正确
        ></div>
      )}

      <div className="main-content">
        {/* 桌面端使用FunctionSidebar */}
        {!isMobile && (
          <FunctionSidebar
            selectedFunction={selectedFunction}
            onFunctionSelect={handleFunctionSelect}
            collapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
            isMobile={isMobile}
            jsonFiles={jsonFiles}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* 移动端使用MobileSidebar */}

        {isMobile && (
          <MobileSidebar
            isOpen={!sidebarCollapsed}
            onClose={handleSidebarToggle}
            selectedFunction={selectedFunction}
            selectedFile={selectedFile}
            onFunctionSelect={handleFunctionSelect}
            onFileSelect={handleFileSelect}
            expandedMenus={expandedMenus}
            onToggleMenu={handleToggleMenu}
            jsonFiles={jsonFiles} // 传入jsonFiles
          />
        )}

        {/* 内容区域 */}
        <div className="content-area">{renderContent()}</div>
      </div>
    </div>
  );
}

export default App;
