import { useState, useEffect } from "react";
import JsonTable from "./components/JsonTable.jsx";
import TopBar from "./components/TopBar.jsx";
import FunctionSidebar from "./components/FunctionSidebar.jsx";
import GlobalSearch from "./components/GlobalSearch.jsx";
import NameSearch from "./components/NameSearch.jsx";
import MobileSidebar from "./components/MobileSidebar.jsx";
import LoadingIndicator from "./components/LoadingIndicator.jsx";
import {
  isJsonCached,
  getJsonFromCache,
  cacheJson,
} from "./utils/JsonCache.jsx";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext.jsx";
import { UserProvider } from "./contexts/UserContext.jsx";
import { EditModeProvider } from "./components/TopBar.jsx";
import "./App.css";

// 主应用内容组件，使用ThemeContext
function AppContent() {
  // 获取主题上下文
  const { theme } = useTheme();

  // State for storing all JSON file names
  const [jsonFiles, setJsonFiles] = useState([]);
  // Currently selected function
  const [selectedFunction, setSelectedFunction] = useState("global-search"); // 默认为全局搜索
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
  // 移动端侧边栏状态
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

        if (fileNames.length > 0) {
          const filesToPreload = fileNames.slice(0, 5);

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
              }, index * 2000); // 每个文件间隔2秒预加载
            });
          }
        }
      } catch (error) {
        console.error("Error loading file list:", error);
        setError(`Failed to find JSON files: ${error.message}`);
      }
    }

    loadJsonFiles();
  }, []); // 移除依赖，只在初始化时加载文件列表

  const handleFileSelect = async (fileName) => {
    setIsLoading(true);
    setError(null);
    setSelectedFunction("translation-tables"); // 当选择文件时，自动切换到翻译表功能

    try {
      console.log(`Loading file: ${fileName}`);

      // 检查缓存中是否有数据
      if (isJsonCached(fileName)) {
        console.log(`Loading ${fileName} from cache`);
        const cachedData = getJsonFromCache(fileName);
        setCurrentJsonData(cachedData);
        setSelectedFile(fileName);
        setIsLoading(false);
        return;
      }

      // 从服务器加载
      const response = await fetch(`/assets/${fileName}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("JSON data loaded:", data);

      // 存入缓存
      cacheJson(fileName, data);

      setCurrentJsonData(data);
      setSelectedFile(fileName);

      // 移动端下选择文件后自动折叠侧边栏
      if (isMobile) {
        setMobileSidebarOpen(false);
      }
    } catch (error) {
      console.error("Error loading JSON file:", error);
      setError(`Failed to load file: ${error.message}, file: ${fileName}`);
      setCurrentJsonData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理功能选择
  const handleFunctionSelect = (funcId) => {
    setSelectedFunction(funcId);

    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  // 处理侧边栏折叠切换
  const handleSidebarToggle = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  // 渲染内容区域
  const renderContent = () => {
    if (selectedFunction === "global-search") {
      return (
        <GlobalSearch
          jsonFiles={jsonFiles}
          onFileSelect={handleFileSelect}
          isMobile={isMobile}
        />
      );
    } else if (selectedFunction === "name-search") {
      return <NameSearch />;
    } else if (selectedFunction === "translation-tables") {
      return isLoading ? (
        <LoadingIndicator message="加载中..." />
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <JsonTable data={currentJsonData} isMobile={isMobile} />
      );
    } else {
      return (
        <GlobalSearch
          jsonFiles={jsonFiles}
          onFileSelect={handleFileSelect}
          isMobile={isMobile}
        />
      );
    }
  };

  return (
    <div
      className={`app-container ${
        isMobile ? "mobile-view" : ""
      } ${theme}-theme`}
    >
      <TopBar isMobile={isMobile} onToggleSidebar={handleSidebarToggle} />

      {isMobile && (
        <MobileSidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          selectedFunction={selectedFunction}
          selectedFile={selectedFile.replace(/\.json$/, "")}
          onFunctionSelect={handleFunctionSelect}
          onFileSelect={(file) => handleFileSelect(`${file}.json`)}
          expandedMenus={expandedMenus}
          onToggleMenu={handleToggleMenu}
          jsonFiles={jsonFiles.map((file) => file.replace(/\.json$/, ""))}
        />
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
            jsonFiles={jsonFiles.map((file) => file.replace(/\.json$/, ""))}
            selectedFile={selectedFile.replace(/\.json$/, "")}
            onFileSelect={(file) => handleFileSelect(`${file}.json`)}
          />
        )}

        <div className={`content-area ${sidebarCollapsed ? "expanded" : ""}`}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// 主应用组件，提供ThemeProvider
function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <EditModeProvider>
          <AppContent />
        </EditModeProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
