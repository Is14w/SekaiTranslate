import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiX,
  FiTag,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import LoadingIndicator from "./LoadingIndicator";
import { isJsonCached, getJsonFromCache, cacheJson } from "../utils/JsonCache";
import "../styles/NameSearch.css";

function NameSearch() {
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nameData, setNameData] = useState(null);

  // 搜索状态
  const [caller, setCaller] = useState("");
  const [callee, setCallee] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 标签相关状态
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [currentTagInput, setCurrentTagInput] = useState("");
  const [currentSelectedSuggestion, setCurrentSelectedSuggestion] =
    useState("");
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // 用于处理点击外部关闭标签建议
  const tagSuggestionsRef = useRef(null);
  // 标签输入框引用
  const tagInputRef = useRef(null);

  // 结果分组
  const [expandedItems, setExpandedItems] = useState([]);

  // 初始加载人称表数据
  useEffect(() => {
    const loadNameData = async () => {
      try {
        setIsLoading(true);

        const fileName = "人称表.json";
        let data;

        // 尝试从缓存获取
        if (isJsonCached(fileName)) {
          data = getJsonFromCache(fileName);
        } else {
          // 从服务器加载
          const response = await fetch(`/assets/${fileName}`);
          if (!response.ok) {
            throw new Error(`无法加载人称表文件: ${response.status}`);
          }

          data = await response.json();
          cacheJson(fileName, data);
        }

        setNameData(data);

        // 提取所有可用的标签
        if (data && data["人称表"]) {
          const uniqueTags = new Set();

          data["人称表"].forEach((entry) => {
            // 收集标签
            Object.keys(entry).forEach((key) => {
              if (key.match(/^Tag_\d+$/) && entry[key]) {
                uniqueTags.add(String(entry[key]).toLowerCase());
              }
            });
          });

          setAllTags(Array.from(uniqueTags).sort());
        }

        setError(null);
      } catch (err) {
        console.error("加载人称表数据出错:", err);
        setError(`无法加载人称表数据: ${err.message}`);
        setNameData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadNameData();
  }, []);

  // 处理搜索
  const handleSearch = useCallback(() => {
    // 如果数据不存在，或称呼者和被称呼者都为空，则不执行搜索
    if (!nameData || (!caller.trim() && !callee.trim() && tags.length === 0)) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 获取表数据
      const tableData = nameData["人称表"];
      let results = [];

      // 筛选匹配记录
      results = tableData.filter((entry) => {
        // 名称匹配条件
        const callerMatch =
          !caller.trim() ||
          entry["称呼者"]?.toLowerCase().includes(caller.toLowerCase());

        const calleeMatch =
          !callee.trim() ||
          entry["被称者"]?.toLowerCase().includes(callee.toLowerCase());

        // 标签匹配条件
        let tagMatch = true;

        if (tags.length > 0) {
          // 收集当前条目的所有标签
          const entryTags = [];
          Object.keys(entry).forEach((key) => {
            if (key.match(/^Tag_\d+$/) && entry[key]) {
              entryTags.push(entry[key].toLowerCase());
            }
          });

          // 检查是否包含所有搜索标签
          tagMatch = tags.every((tag) => entryTags.includes(tag.toLowerCase()));
        }

        // 只有同时满足所有条件才返回
        return callerMatch && calleeMatch && tagMatch;
      });

      setSearchResults(results);
    } catch (err) {
      console.error("搜索出错:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [nameData, caller, callee, tags]);

  // 当输入改变时执行搜索
  useEffect(() => {
    if (hasSearched) {
      handleSearch();
    }
  }, [caller, callee, tags, handleSearch, hasSearched]);

  // 处理标签输入
  const handleTagInputChange = (e) => {
    const value = e.target.value;

    if (value.startsWith("#")) {
      const tagText = value.substring(1);
      setCurrentTagInput(tagText.toLowerCase());

      // 过滤并显示标签建议
      if (allTags.length > 0) {
        const suggestions = allTags
          .filter((tag) => tag.toLowerCase().includes(tagText.toLowerCase()))
          .filter((tag) => !tags.includes(tag.toLowerCase()))
          .slice(0, 10);

        setTagSuggestions(suggestions);
        setShowTagSuggestions(suggestions.length > 0);
      }
    } else {
      setCurrentTagInput("");
      setShowTagSuggestions(false);
    }
  };

  // 点击选择标签建议
  const selectTagSuggestion = (tag) => {
    // 添加标签
    if (!tags.includes(tag.toLowerCase())) {
      const newTags = [...tags, tag.toLowerCase()];
      setTags(newTags);
    }

    // 清空输入框
    if (tagInputRef.current) {
      tagInputRef.current.value = "";
    }

    // 隐藏建议
    setShowTagSuggestions(false);
  };

  // 处理标签回车添加
  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter" && currentTagInput) {
      e.preventDefault();

      if (currentSelectedSuggestion && showTagSuggestions) {
        // 如果有选中建议，则使用建议
        selectTagSuggestion(currentSelectedSuggestion);
      } else if (tagSuggestions.length > 0) {
        // 否则使用第一个建议
        selectTagSuggestion(tagSuggestions[0]);
      } else if (currentTagInput.trim()) {
        // 或者使用当前输入
        selectTagSuggestion(currentTagInput.trim());
      }

      return;
    }

    // 处理上下键导航标签
    if (showTagSuggestions && tagSuggestions.length > 0) {
      const currentIndex = tagSuggestions.findIndex(
        (t) => t.toLowerCase() === currentSelectedSuggestion
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex =
          currentIndex < tagSuggestions.length - 1 ? currentIndex + 1 : 0;
        setCurrentSelectedSuggestion(tagSuggestions[nextIndex].toLowerCase());
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : tagSuggestions.length - 1;
        setCurrentSelectedSuggestion(tagSuggestions[prevIndex].toLowerCase());
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowTagSuggestions(false);
        return;
      }
    }
  };

  // 删除标签
  const removeTag = (tagToRemove) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);
  };

  // 清除所有筛选条件
  const handleClearAll = () => {
    setCaller("");
    setCallee("");
    setTags([]);
    setSearchResults([]);
    setHasSearched(false);
  };

  // 点击切换展开/折叠结果项
  const toggleResultItem = (id) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // 处理点击标签建议外部以关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        tagSuggestionsRef.current &&
        !tagSuggestionsRef.current.contains(event.target)
      ) {
        setShowTagSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 当获取建议时，默认选中第一个
  useEffect(() => {
    if (tagSuggestions.length > 0) {
      setCurrentSelectedSuggestion(tagSuggestions[0].toLowerCase());
    } else {
      setCurrentSelectedSuggestion("");
    }
  }, [tagSuggestions]);

  if (isLoading) {
    return (
      <div className="name-search-loading">
        <LoadingIndicator message="正在加载人称表数据..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="name-search-error">
        <FiAlertCircle size={32} />
        <h3>无法加载人称表</h3>
        <p>{error}</p>
        <p>人名检索功能依赖于"人称表.json"文件，请确保此文件存在且格式正确。</p>
      </div>
    );
  }

  return (
    <motion.div
      className="name-search-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="name-search-header">
        <h2>人名检索</h2>
        <p className="name-search-description">
          搜索角色之间的称呼方式。输入称呼者（说话的人）和被称者（被叫的人）进行搜索。支持模糊匹配。
          <br />
          例如，称呼者为"星乃一歌"，被称者为"朝比奈まふゆ"。
          <br />
          可以输入"星乃"和"mfy"进行搜索。
        </p>
      </div>

      <div className="name-search-form">
        <div className="search-row">
          <div className="search-field">
            <label htmlFor="caller">称呼者:</label>
            <div className="input-wrapper">
              <FiSearch className="search-icon" />
              <input
                id="caller"
                type="text"
                value={caller}
                onChange={(e) => setCaller(e.target.value)}
                placeholder="输入角色名称"
              />
              {caller && (
                <button
                  className="clear-input"
                  onClick={() => setCaller("")}
                  aria-label="清除称呼者"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="search-field">
            <label htmlFor="callee">被称者:</label>
            <div className="input-wrapper">
              <FiSearch className="search-icon" />
              <input
                id="callee"
                type="text"
                value={callee}
                onChange={(e) => setCallee(e.target.value)}
                placeholder="输入角色名称"
              />
              {callee && (
                <button
                  className="clear-input"
                  onClick={() => setCallee("")}
                  aria-label="清除被称者"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="tag-row">
          <div className="tag-field">
            <label htmlFor="tag-input">标签筛选:</label>
            <div className="input-wrapper tag-input-wrapper">
              <FiTag className="tag-icon" />
              <input
                id="tag-input"
                ref={tagInputRef}
                type="text"
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                placeholder="#输入标签名称"
              />

              {/* 标签建议下拉框 */}
              {showTagSuggestions && (
                <div
                  className="tag-suggestions-container"
                  ref={tagSuggestionsRef}
                >
                  {isLoadingTags ? (
                    <div className="tag-suggestions-loading">
                      <LoadingIndicator small message="加载标签中..." />
                    </div>
                  ) : (
                    <ul className="tag-suggestions-list">
                      {tagSuggestions.length > 0 ? (
                        tagSuggestions.map((tag) => (
                          <li
                            key={tag}
                            className={`tag-suggestion-item ${
                              tag.toLowerCase() === currentSelectedSuggestion
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => selectTagSuggestion(tag)}
                            onMouseEnter={() =>
                              setCurrentSelectedSuggestion(tag.toLowerCase())
                            }
                          >
                            <FiTag className="tag-suggestion-icon" />
                            <span>{tag}</span>
                            {tags.includes(tag.toLowerCase()) && (
                              <span className="tag-already-used">已使用</span>
                            )}
                          </li>
                        ))
                      ) : currentTagInput ? (
                        <li className="tag-no-suggestions">
                          没有匹配"{currentTagInput}"的标签
                        </li>
                      ) : (
                        <li className="tag-no-suggestions">未找到标签</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            className="search-button"
            onClick={() => {
              if (!hasSearched) setHasSearched(true);
              handleSearch();
            }}
            disabled={isSearching}
          >
            {isSearching ? "搜索中..." : "搜索"}
          </button>

          {(caller || callee || tags.length > 0) && (
            <button className="clear-button" onClick={handleClearAll}>
              清除
            </button>
          )}
        </div>

        {/* 显示已添加的标签 */}
        {tags.length > 0 && (
          <div className="search-tags">
            {tags.map((tag) => (
              <div key={tag} className="search-tag">
                <span className="tag-hash">#</span>
                <span className="tag-text">{tag}</span>
                <button
                  className="tag-remove"
                  onClick={() => removeTag(tag)}
                  aria-label="删除标签"
                >
                  <FiX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 搜索结果区域 */}
      <div className="name-search-results">
        {isSearching ? (
          <LoadingIndicator message="正在搜索..." />
        ) : hasSearched ? (
          searchResults.length > 0 ? (
            <>
              <div className="results-summary">
                找到 {searchResults.length} 条结果
              </div>

              <div className="results-list">
                {searchResults.map((result) => {
                  const isExpanded = expandedItems.includes(result.id);

                  // 收集标签
                  const resultTags = [];
                  Object.keys(result).forEach((key) => {
                    if (key.match(/^Tag_\d+$/) && result[key]) {
                      resultTags.push(result[key]);
                    }
                  });

                  return (
                    <div
                      key={result.id}
                      className={`result-item ${isExpanded ? "expanded" : ""}`}
                      onClick={() => toggleResultItem(result.id)}
                    >
                      <div className="result-header">
                        <div className="name-container">
                          <span className="caller-name">{result.称呼者}</span>
                          <span className="arrow">→</span>
                          <span className="callee-name">{result.被称者}</span>
                        </div>

                        {result.原文 && result.译文 ? (
                          <div className="term-container">
                            <span className="original-term">{result.原文}</span>
                            <span className="term-separator">→</span>
                            <span className="translated-term">
                              {result.译文}
                            </span>
                          </div>
                        ) : (
                          <div className="term-container missing">
                            <span>未填写称呼</span>
                          </div>
                        )}

                        <div className="result-controls">
                          <button className="expand-button">
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="result-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="detail-row">
                              <span className="detail-label">ID:</span>
                              <span className="detail-value">{result.id}</span>
                            </div>

                            {resultTags.length > 0 && (
                              <div className="detail-row">
                                <span className="detail-label">标签:</span>
                                <div className="detail-tags">
                                  {resultTags.map((tag, index) => (
                                    <span key={index} className="detail-tag">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="no-results">
              <FiAlertCircle size={24} />
              <p>未找到匹配结果</p>
              {(caller || callee || tags.length > 0) && (
                <p className="hint">尝试减少筛选条件或使用不同的关键词</p>
              )}
            </div>
          )
        ) : (
          <div className="search-placeholder">
            <FiSearch size={32} opacity={0.5} />
            <p>请输入搜索条件以查找角色间的称呼方式</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default NameSearch;
