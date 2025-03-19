// 用于将 public/assets 中的JSON文件迁移到Deno KV

import { initKV } from "../backend/cmd/server/auth.ts";
import {
  saveJsonToKV,
  getObjectSize,
} from "../backend/cmd/server/jsonChunker.ts";

async function migrateJsonToKV() {
  try {
    console.log("开始迁移JSON文件到Deno KV...");

    // 获取KV连接
    const kv = await initKV();
    if (!kv) {
      throw new Error("无法连接到KV数据库");
    }

    // 读取assets目录下的所有JSON文件
    let fileCount = 0;
    let successCount = 0;
    let chunkedCount = 0;

    // 用于迁移单个文件的函数
    async function migrateFile(filename) {
      try {
        const key = filename.replace(/\.json$/, "");
        const filePath = `./public/assets/${filename}`;
        console.log(`\n处理文件: ${filePath}`);

        const content = await Deno.readTextFile(filePath);
        const jsonData = JSON.parse(content);

        // 检查文件大小
        const dataSize = getObjectSize(jsonData);
        console.log(`文件大小: ${dataSize} 字节`);

        // 如果是超大文件，打印更多信息
        if (dataSize > 50000) {
          // 检查数据结构
          console.log(`数据结构: ${typeof jsonData}`);

          if (typeof jsonData === "object" && jsonData !== null) {
            const keys = Object.keys(jsonData);
            console.log(`顶层键: ${keys.join(", ")}`);

            if (keys.length === 1) {
              const rootKey = keys[0];
              const rootData = jsonData[rootKey];
              console.log(
                `主数据类型: ${
                  Array.isArray(rootData) ? "Array" : typeof rootData
                }`
              );

              if (Array.isArray(rootData)) {
                console.log(`数组长度: ${rootData.length}`);

                // 检查数组元素大小
                if (rootData.length > 0) {
                  const sampleSizes = rootData
                    .slice(0, 3)
                    .map((item) => getObjectSize(item));
                  console.log(`前3个元素大小(字节): ${sampleSizes.join(", ")}`);

                  // 查找最大元素
                  let maxSize = 0;
                  let maxIndex = -1;
                  rootData.forEach((item, index) => {
                    const size = getObjectSize(item);
                    if (size > maxSize) {
                      maxSize = size;
                      maxIndex = index;
                    }
                  });

                  if (maxSize > 30000) {
                    console.warn(
                      `警告: 发现超大元素，索引=${maxIndex}, 大小=${maxSize}字节`
                    );
                  }
                }
              }
            }
          }
        }

        // 使用jsonChunker保存到KV
        console.log(`开始保存 ${key} 到KV...`);
        const result = await saveJsonToKV(kv, key, jsonData);

        if (result.chunked) {
          console.log(`✅ 成功迁移(分块): ${filename} (${result.chunks}块)`);
          chunkedCount++;
        } else {
          console.log(`✅ 成功迁移: ${filename}`);
        }

        return true;
      } catch (fileError) {
        console.error(`❌ 迁移失败 ${filename}:`, fileError);
        return false;
      }
    }

    // 遍历文件夹
    for await (const entry of Deno.readDir("./public/assets")) {
      if (!entry.isFile || !entry.name.endsWith(".json")) continue;

      fileCount++;
      const success = await migrateFile(entry.name);
      if (success) successCount++;
    }

    console.log(`\n迁移完成!`);
    console.log(`总文件数: ${fileCount}`);
    console.log(`成功迁移: ${successCount} (其中分块处理: ${chunkedCount})`);
    console.log(`失败: ${fileCount - successCount}`);
  } catch (error) {
    console.error("迁移过程中出错:", error);
  }
}

// 执行迁移
if (import.meta.main) {
  console.log("启动JSON迁移工具...");
  await migrateJsonToKV();
}
