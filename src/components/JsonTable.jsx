import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../styles/JsonTable.css";

function JsonTable({ data }) {
  // State for storing search term
  const [searchTerm, setSearchTerm] = useState("");
  // Store table title
  const [title, setTitle] = useState("");
  // Store table data
  const [tableData, setTableData] = useState([]);
  // Store column names (excluding id field)
  const [columns, setColumns] = useState([]);

  // Process data on initialization
  useEffect(() => {
    // Check if data exists
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      return;
    }

    // Get sheet title (first key)
    const dataTitle = Object.keys(data)[0];
    setTitle(dataTitle);

    // Check table data
    const rawTableData = data[dataTitle];
    if (
      !rawTableData ||
      !Array.isArray(rawTableData) ||
      rawTableData.length === 0
    ) {
      return;
    }

    // Filter out rows with id < 0
    const validData = rawTableData.filter((row) => row.id >= 0);
    setTableData(validData);

    // Get column names excluding the id field
    if (validData.length > 0) {
      const allColumns = Object.keys(validData[0]);
      const filteredColumns = allColumns.filter((column) => column !== "id");
      setColumns(filteredColumns);
    }
  }, [data]);

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Create debounced search function with useCallback
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
    }, 200), // Increased delay for better performance
    []
  );

  // Handle search input change with better performance
  const handleSearchChange = (e) => {
    // Don't call e.persist() for newer React versions
    debouncedSearch(e.target.value);
  };

  // Filter data using useMemo for better performance
  const filteredData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];

    if (searchTerm.trim() === "") {
      return tableData;
    }

    const lowercasedTerm = searchTerm.toLowerCase();

    return tableData.filter((row) => {
      // Search for matches in all columns
      return columns.some((column) => {
        const value = row[column];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowercasedTerm);
      });
    });
  }, [searchTerm, tableData, columns]);

  // If no data, show message
  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return <div className="no-data">请选择一个JSON文件查看内容</div>;
  }

  // If no table data, show message
  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return (
      <div className="no-data">此JSON文件不包含表格数据或所有数据的ID小于0</div>
    );
  }

  return (
    <div className="json-table-container">
      {title && <h2>{title}</h2>}

      <div className="search-container">
        <input
          type="text"
          placeholder="搜索..."
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>

      {columns.length > 0 && filteredData.length > 0 ? (
        <>
          <div className="table-wrapper">
            <table className="json-table">
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <th key={index}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((column, colIndex) => (
                      <td key={colIndex}>
                        {row[column] === null
                          ? "N/A"
                          : String(row[column])
                              .split("\n")
                              .map((line, i) => (
                                <React.Fragment key={i}>
                                  {line}
                                  {i <
                                    String(row[column]).split("\n").length -
                                      1 && <br />}
                                </React.Fragment>
                              ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="results-count">
            显示 {filteredData.length} 条结果 (共 {tableData.length} 条)
          </div>
        </>
      ) : (
        <div className="no-data">找不到匹配的数据</div>
      )}
    </div>
  );
}

export default JsonTable;
