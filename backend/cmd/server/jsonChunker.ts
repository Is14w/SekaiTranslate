/**
 * 用于处理大型JSON数据的分块存储和读取
 * 解决 Deno KV 单值大小限制(64KB)问题
 */

/**
 * 将大型 JSON 对象拆分为多个较小的块
 * @param obj 要拆分的对象
 * @param maxChunkSize 每块的最大大小(字节)
 * @returns 拆分后的块数组
 */
export function splitLargeObject(
  obj: unknown,
  maxChunkSize: number = 60000
): unknown[] {
  // 如果对象是数组类型
  if (Array.isArray(obj)) {
    const chunks: unknown[][] = [];
    let currentChunk: unknown[] = [];
    let currentSize = 0;

    // 遍历数组中的每个项
    for (const item of obj) {
      const itemString = JSON.stringify(item);
      const itemSize = itemString.length;

      // 如果单个项目就超过了最大限制，则需要特殊处理
      if (itemSize > maxChunkSize) {
        console.warn(
          `警告: 发现超大项目 (${itemSize} bytes)，这可能需要进一步拆分`
        );
        // 如果当前块不为空，先保存现有块
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentSize = 0;
        }
        // 将大项添加为单独的块
        chunks.push([item]);
      } else if (currentSize + itemSize > maxChunkSize) {
        // 如果添加此项会超出当前块的大小限制，创建新块
        chunks.push(currentChunk);
        currentChunk = [item];
        currentSize = itemSize;
      } else {
        // 添加到当前块
        currentChunk.push(item);
        currentSize += itemSize;
      }
    }

    // 添加最后一个块（如果有）
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  } else {
    // 如果是对象类型，按属性拆分
    const chunks: Record<string, unknown>[] = [];
    let currentChunk: Record<string, unknown> = {};
    let currentSize = 2; // 开始 {} 的大小

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const entryString = JSON.stringify({ [key]: value });
      const entrySize = entryString.length - 2; // 减去 {} 的大小

      if (entrySize > maxChunkSize) {
        console.warn(
          `警告: 属性 "${key}" 过大 (${entrySize} bytes)，需要特殊处理`
        );

        // 如果当前块不为空，保存它
        if (Object.keys(currentChunk).length > 0) {
          chunks.push(currentChunk);
          currentChunk = {};
          currentSize = 2;
        }

        // 对大属性值做进一步处理
        if (Array.isArray(value)) {
          // 如果值是数组，拆分它
          const valueChunks = splitLargeObject(value);
          chunks.push({
            [`${key}_chunk_info`]: {
              type: "array",
              chunks: valueChunks.length,
            },
          });

          // 存储每个数组块
          valueChunks.forEach((chunk, index) => {
            chunks.push({ [`${key}_chunk_${index}`]: chunk });
          });
        } else if (typeof value === "object" && value !== null) {
          // 如果值是对象，拆分它
          const valueChunks = splitLargeObject(value);
          chunks.push({
            [`${key}_chunk_info`]: {
              type: "object",
              chunks: valueChunks.length,
            },
          });

          // 存储每个对象块
          valueChunks.forEach((chunk, index) => {
            chunks.push({ [`${key}_chunk_${index}`]: chunk });
          });
        } else {
          // 如果是字符串或其他原始类型，则可能需要拆分字符串
          console.error(`无法处理的大型属性: ${key}，类型: ${typeof value}`);
          chunks.push({ [`${key}_error`]: "VALUE_TOO_LARGE" });
        }
      } else if (currentSize + entrySize > maxChunkSize) {
        // 如果添加此属性会超出当前块的大小限制，创建新块
        chunks.push(currentChunk);
        currentChunk = { [key]: value };
        currentSize = entrySize + 2; // +2 for {}
      } else {
        // 添加到当前块
        currentChunk[key] = value;
        currentSize += entrySize;
      }
    }

    // 添加最后一个块（如果有）
    if (Object.keys(currentChunk).length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

/**
 * 检查对象大小是否超过KV限制
 * @param obj 要检查的对象
 * @returns 对象大小（字节）
 */
export function getObjectSize(obj: unknown): number {
  return JSON.stringify(obj).length;
}

/**
 * 将JSON数据存储到KV中，自动处理大型数据的分块
 * @param kv Deno.Kv 实例
 * @param key 存储的键名(不含后缀)
 * @param data JSON数据
 * @returns 是否保存成功，如果分块则返回块数
 */
export async function saveJsonToKV(
  kv: Deno.Kv,
  key: string,
  data: unknown
): Promise<{ success: boolean; chunked: boolean; chunks?: number }> {
  try {
    const dataSize = getObjectSize(data);

    // 添加调试信息
    console.log(`数据 ${key} 大小: ${dataSize} 字节`);

    // 如果数据大小在限制范围内，直接保存
    if (dataSize <= 60000) {
      try {
        await kv.set(["json_data", key], data);
        return { success: true, chunked: false };
      } catch (err) {
        // 如果即使标准值也保存失败，尝试分块
        console.warn(`直接保存失败，尝试分块: ${err.message}`);
      }
    }

    // 数据大小超出限制或直接保存失败，需要分块
    console.log(`数据 ${key} 进行分块处理`);

    // 获取根对象的结构
    const rootKeys = Object.keys(data as Record<string, unknown>);

    if (rootKeys.length === 1) {
      // 通常JSON文件内容是 { "表名": [ ...数据 ] }
      const rootKey = rootKeys[0];
      const tableData = (data as Record<string, unknown>)[rootKey];

      if (Array.isArray(tableData)) {
        // 拆分数组为多个块 - 使用更小的块大小 (40KB)
        const chunks = splitLargeObject(tableData, 40000);

        // 存储元信息 - 很小，应该没问题
        try {
          const metaData = {
            chunked: true,
            chunksCount: chunks.length,
            rootKey: rootKey,
            dataType: "array",
            originalSize: dataSize,
          };

          // 检查元数据大小
          if (getObjectSize(metaData) > 60000) {
            throw new Error(`元数据过大: ${getObjectSize(metaData)} 字节`);
          }

          await kv.set(["json_data", key], metaData);
        } catch (err) {
          console.error(`保存元数据失败: ${err.message}`);
          throw err; // 元数据保存失败是致命错误
        }

        // 存储每个块
        for (let i = 0; i < chunks.length; i++) {
          // 创建块数据并检查大小
          const chunkData = {
            [rootKey]: chunks[i],
            _chunkIndex: i,
            _totalChunks: chunks.length,
          };

          const chunkSize = getObjectSize(chunkData);
          if (chunkSize > 60000) {
            throw new Error(
              `块 ${i} 仍然过大: ${chunkSize} 字节，需要更进一步拆分`
            );
          }

          try {
            await kv.set(["json_data_chunk", key, i], chunkData);
            console.log(
              `  ✓ 块 ${i + 1}/${chunks.length} 已保存 (${chunkSize} 字节)`
            );
          } catch (err) {
            console.error(`保存块 ${i} 失败: ${err.message}`);
            throw err;
          }
        }

        console.log(`成功拆分并存储: ${key} (${chunks.length} 个块)`);
        return { success: true, chunked: true, chunks: chunks.length };
      } else {
        // 处理对象值
        // 使用更小的分块大小
        const chunks = splitLargeObject(data, 40000);

        // 保存元数据
        try {
          const metaData = {
            chunked: true,
            chunksCount: chunks.length,
            dataType: "object",
            originalSize: dataSize,
          };
          await kv.set(["json_data", key], metaData);
        } catch (err) {
          console.error(`保存元数据失败: ${err.message}`);
          throw err;
        }

        // 存储每个块
        for (let i = 0; i < chunks.length; i++) {
          // 创建块数据并移除可能过大的值
          const chunkData = {
            ...chunks[i],
            _chunkIndex: i,
            _totalChunks: chunks.length,
          };

          // 检查大小
          const chunkSize = getObjectSize(chunkData);
          if (chunkSize > 60000) {
            console.warn(
              `块 ${i} 大小 (${chunkSize} 字节) 超过限制，尝试进一步拆分`
            );
            // 尝试进一步分块或跳过过大的属性
            const safeChunk = ensureChunkSize(chunkData);
            await kv.set(["json_data_chunk", key, i], safeChunk);
          } else {
            await kv.set(["json_data_chunk", key, i], chunkData);
          }

          console.log(`  ✓ 块 ${i + 1}/${chunks.length} 已保存`);
        }

        console.log(`成功拆分并存储: ${key} (${chunks.length} 个块)`);
        return { success: true, chunked: true, chunks: chunks.length };
      }
    } else {
      // 多根键对象
      // 使用更小的块大小
      const chunks = splitLargeObject(data, 40000);

      // 存储元信息
      try {
        const metaData = {
          chunked: true,
          chunksCount: chunks.length,
          dataType: "multi-root",
          originalSize: dataSize,
        };
        await kv.set(["json_data", key], metaData);
      } catch (err) {
        console.error(`保存元数据失败: ${err.message}`);
        throw err;
      }

      // 存储每个块
      for (let i = 0; i < chunks.length; i++) {
        // 创建块数据
        const chunkData = {
          ...chunks[i],
          _chunkIndex: i,
          _totalChunks: chunks.length,
        };

        // 检查大小
        const chunkSize = getObjectSize(chunkData);
        if (chunkSize > 60000) {
          console.warn(
            `块 ${i} 大小 (${chunkSize} 字节) 超过限制，尝试进一步拆分`
          );

          // 尝试进一步分块
          const safeChunk = ensureChunkSize(chunkData);
          await kv.set(["json_data_chunk", key, i], safeChunk);
        } else {
          await kv.set(["json_data_chunk", key, i], chunkData);
        }

        console.log(`  ✓ 块 ${i + 1}/${chunks.length} 已保存`);
      }

      console.log(`成功拆分并存储: ${key} (${chunks.length} 个块)`);
      return { success: true, chunked: true, chunks: chunks.length };
    }
  } catch (error) {
    console.error(`保存JSON到KV时出错 (${key}):`, error);
    throw error;
  }
}

/**
 * 确保对象大小在KV限制内，必要时移除或压缩大属性
 * @param obj 要检查的对象
 * @returns 安全大小的对象
 */
function ensureChunkSize(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const maxSize = 60000;
  const originalSize = getObjectSize(obj);

  if (originalSize <= maxSize) {
    return obj;
  }

  console.log(`对象大小 ${originalSize} 字节，超过限制，正在优化...`);

  // 复制基本对象结构和元数据
  const result: Record<string, unknown> = {
    _chunkIndex: obj._chunkIndex,
    _totalChunks: obj._totalChunks,
    _oversized: true,
  };

  // 计算特殊字段的大小
  const metaSize = getObjectSize(result);
  const remainingSize = maxSize - metaSize - 100; // 100字节的安全余量

  // 按大小排序属性
  const props = Object.entries(obj)
    .filter(([k]) => !k.startsWith("_")) // 排除元数据字段
    .map(([k, v]) => ({
      key: k,
      value: v,
      size: getObjectSize({ [k]: v }),
    }))
    .sort((a, b) => a.size - b.size); // 从小到大排序

  // 优先添加小属性
  let currentSize = metaSize;
  let includedCount = 0;

  for (const prop of props) {
    if (currentSize + prop.size <= maxSize) {
      result[prop.key] = prop.value;
      currentSize += prop.size;
      includedCount++;
    } else {
      // 标记过大属性
      result[`${prop.key}_oversized`] = true;
      result[`${prop.key}_size`] = prop.size;
    }
  }

  console.log(
    `  优化后大小: ${getObjectSize(result)} 字节，保留了 ${includedCount}/${
      props.length
    } 个属性`
  );
  return result;
}

/**
 * 从KV读取JSON数据，自动处理分块数据的合并
 * @param kv Deno.Kv 实例
 * @param key 存储的键名(不含后缀)
 * @returns 完整的JSON数据
 */
export async function getJsonFromKV(
  kv: Deno.Kv,
  key: string
): Promise<unknown | null> {
  try {
    console.log(`从KV获取JSON: ${key}`);

    // 获取数据或元数据
    const result = await kv.get(["json_data", key]);

    if (!result.value) {
      console.log(`在KV中没有找到数据: ${key}`);
      return null; // 未找到数据
    }

    // 检查是否为分块数据
    const metadata = result.value as Record<string, unknown>;
    if (metadata.chunked) {
      console.log(
        `发现分块数据: ${key}, 类型: ${metadata.dataType}, 块数: ${metadata.chunksCount}`
      );

      // 是分块数据，需要合并
      const chunksCount = metadata.chunksCount as number;

      // 如果是数组拆分格式
      if (metadata.dataType === "array" && metadata.rootKey) {
        const rootKey = metadata.rootKey as string;
        let combinedArray: unknown[] = [];

        console.log(
          `合并数组类型数据, rootKey: ${rootKey}, 块数: ${chunksCount}`
        );

        // 加载并合并所有块
        for (let i = 0; i < chunksCount; i++) {
          console.log(`获取块 ${i + 1}/${chunksCount}`);
          const chunkResult = await kv.get(["json_data_chunk", key, i]);

          if (!chunkResult.value) {
            console.error(`找不到数据块: ${key}_${i}`);
            continue; // 跳过丢失的块，而不是中断整个过程
          }

          const chunkData = chunkResult.value as Record<string, unknown>;
          const chunkArray = chunkData[rootKey];

          // 确保块数据是数组类型
          if (!Array.isArray(chunkArray)) {
            console.error(`块 ${i} 的数据不是数组类型:`, chunkArray);
            continue;
          }

          // 将当前块的数据添加到结果数组
          combinedArray = [...combinedArray, ...chunkArray];
          console.log(
            `添加了 ${chunkArray.length} 项到合并数组，当前总数: ${combinedArray.length}`
          );
        }

        console.log(`完成数组合并，总项数: ${combinedArray.length}`);
        return { [rootKey]: combinedArray };
      } else {
        // 对象类型的拆分
        let combinedData: Record<string, unknown> = {};

        console.log(`合并对象类型数据, 块数: ${chunksCount}`);

        for (let i = 0; i < chunksCount; i++) {
          console.log(`获取块 ${i + 1}/${chunksCount}`);
          const chunkResult = await kv.get(["json_data_chunk", key, i]);

          if (!chunkResult.value) {
            console.error(`找不到数据块: ${key}_${i}`);
            continue; // 跳过丢失的块
          }

          // 复制当前块中的所有属性到结果对象(排除元数据属性)
          const chunkData = chunkResult.value as Record<string, unknown>;
          const filteredChunkData: Record<string, unknown> = {};

          // 过滤掉元数据字段
          Object.entries(chunkData).forEach(([k, v]) => {
            if (!k.startsWith("_")) {
              filteredChunkData[k] = v;
            }
          });

          // 合并到结果对象
          combinedData = { ...combinedData, ...filteredChunkData };
          console.log(
            `合并了块 ${i + 1} 的数据，当前合并对象有 ${
              Object.keys(combinedData).length
            } 个属性`
          );
        }

        console.log(
          `完成对象合并，总属性数: ${Object.keys(combinedData).length}`
        );
        return combinedData;
      }
    }

    // 非分块数据，确保返回有效对象
    console.log(`返回非分块数据: ${key}`);
    return result.value;
  } catch (error) {
    console.error(`从KV获取JSON错误 (${key}):`, error);
    // 返回空对象而不是抛出错误，避免前端崩溃
    return null;
  }
}
