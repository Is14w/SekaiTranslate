const jsonCache = new Map();

// 检查是否已缓存
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