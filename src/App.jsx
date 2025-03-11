import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import JsonTable from "./components/JsonTable";
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

  // Handle file selection
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
    console.log("Sidebar toggle clicked, current state:", sidebarCollapsed);
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="app-container">
      <Sidebar
        files={jsonFiles}
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      <div
        className={`content-area ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <JsonTable data={currentJsonData} />
        )}
      </div>
    </div>
  );
}

export default App;
