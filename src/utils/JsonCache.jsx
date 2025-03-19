// 扩展JsonCache以支持表格数据和时间戳
const jsonCache = new Map();
const tableCache = new Map();

// 缓存过期时间（毫秒）
const CACHE_EXPIRY = 10 * 60 * 1000; // 10mins

// 检查JSON是否已缓存
export const isJsonCached = (fileName) => {
  return jsonCache.has(fileName);
};

// 获取缓存的JSON数据
export const getJsonFromCache = (fileName) => {
  return jsonCache.get(fileName);
};

// 将JSON数据存入缓存
export const cacheJson = (fileName, data) => {
  jsonCache.set(fileName, data);
};

// 表格数据缓存相关函数
// 检查表格是否已缓存且未过期
export const isTableCached = (tableId) => {
  if (!tableCache.has(tableId)) return false;

  const cachedData = tableCache.get(tableId);
  const now = Date.now();

  // 检查是否过期
  return cachedData && now - cachedData.timestamp < CACHE_EXPIRY;
};

// 获取缓存的表格数据
export const getTableFromCache = (tableId) => {
  if (!isTableCached(tableId)) return null;
  return tableCache.get(tableId).data;
};

// 将表格数据存入缓存
export const cacheTable = (tableId, data) => {
  tableCache.set(tableId, {
    data,
    timestamp: Date.now(),
  });
};

// 检查表格是否正在加载中
const loadingTables = new Set();
export const isTableLoading = (tableId) => {
  return loadingTables.has(tableId);
};

// 标记表格为加载中
export const markTableLoading = (tableId) => {
  loadingTables.add(tableId);
};

// 清除表格加载中标记
export const clearTableLoading = (tableId) => {
  loadingTables.delete(tableId);
};

// 获取所有表格ID
export const getCachedTableIds = () => {
  return Array.from(tableCache.keys());
};

// 清理过期的表格缓存
export const cleanExpiredTableCache = () => {
  const now = Date.now();
  let cleanedCount = 0;

  tableCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_EXPIRY) {
      tableCache.delete(key);
      cleanedCount++;
    }
  });

  return cleanedCount;
};

// 日志缓存状态信息
export const logCacheStatus = () => {
  console.log(`[Cache] JSON缓存: ${jsonCache.size}项`);
  console.log(`[Cache] 表格缓存: ${tableCache.size}项`);

  // 输出每个已缓存表格的信息
  if (tableCache.size > 0) {
    const now = Date.now();
    tableCache.forEach((value, key) => {
      const ageMinutes = ((now - value.timestamp) / 60000).toFixed(1);
      console.log(`[Cache] - ${key}: ${ageMinutes}分钟前缓存`);
    });
  }
};
