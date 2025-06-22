# KV 数据库分类分页导出功能

## 🎯 功能概述

本功能为 Cloudflare KV 数据库中的海报信息提供按分类分页的导出服务，优化前端加载性能。

## 📋 分类说明

支持以下四个分类：
- **工科** (`gongke`) - 工程、技术相关海报
- **文科** (`wenke`) - 人文、社会科学相关海报  
- **商科** (`shangke`) - 商业、经济相关海报
- **理科** (`like`) - 自然科学相关海报

## 🚀 API 接口

### 1. 导出分类分页数据
```http
POST /api/admin/export-categorized-data
```

**响应示例：**
```json
{
  "success": true,
  "message": "分类分页数据导出成功",
  "totalPosters": 150,
  "categories": {
    "gongke": { "count": 60, "pages": 12 },
    "wenke": { "count": 30, "pages": 6 },
    "shangke": { "count": 35, "pages": 7 },
    "like": { "count": 25, "pages": 5 }
  }
}
```

### 2. 获取导出元数据
```http
GET /api/exported-data/metadata
```

**响应示例：**
```json
{
  "success": true,
  "metadata": {
    "exportTime": "2024-01-15T10:30:00.000Z",
    "totalPosters": 150,
    "categories": {
      "gongke": { "count": 60, "pages": 12 },
      "wenke": { "count": 30, "pages": 6 },
      "shangke": { "count": 35, "pages": 7 },
      "like": { "count": 25, "pages": 5 }
    },
    "postersPerPage": 5,
    "categoryMapping": {
      "工科": "gongke",
      "文科": "wenke",
      "商科": "shangke", 
      "理科": "like"
    }
  }
}
```

### 3. 获取分类分页数据
```http
GET /api/exported-data/{category}/{page}
```

**参数说明：**
- `category`: 分类英文名 (gongke, wenke, shangke, like)
- `page`: 页码 (从1开始)

**示例：**
```http
GET /api/exported-data/gongke/1
GET /api/exported-data/wenke/2
GET /api/exported-data/shangke/1
GET /api/exported-data/like/3
```

**响应示例：**
```json
{
  "success": true,
  "category": "gongke",
  "page": 1,
  "posters": [
    {
      "id": "poster_1750313899488_btyz0v6",
      "title": "对抗机器学习及人工智能的可靠性",
      "description": "对抗学习，大模型，人工智能的稳定性...",
      "category": "工科",
      "targetAudience": ["计算机、人工智能、数据科学、网络安全、软件工程等相关专业"],
      "imageKey": "posters/1750313896799-169对抗机器学习及人工智能的可靠性.jpg",
      "imageUrl": "https://api.capstoneketi.com/api/get-poster-url/posters%2F1750313896799-169%E5%AF%B9%E6%8A%97%E6%9C%BA%E5%99%A8%E5%AD%A6%E4%B9%A0%E5%8F%8A%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E7%9A%84%E5%8F%AF%E9%9D%A0%E6%80%A7.jpg",
      "createdAt": 1750313899488,
      "updatedAt": 1750313899488
    }
    // ... 更多海报记录
  ],
  "count": 5
}
```

### 4. 生成静态JSON数据
```http
GET /api/admin/static-json-data
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "gongke": {
      "1": [/* 5条工科海报 */],
      "2": [/* 5条工科海报 */],
      // ... 更多页
    },
    "wenke": {
      "1": [/* 5条文科海报 */],
      // ... 更多页
    }
    // ... 其他分类
  }
}
```

### 5. 清理导出的数据
```http
DELETE /api/admin/exported-data
```

**响应示例：**
```json
{
  "success": true,
  "message": "导出的数据已清理"
}
```

## 💾 数据存储

### KV 键名格式
- 分类分页数据：`EXPORT_{category}_{page}`
- 元数据：`EXPORT_METADATA`

### 示例键名
```
EXPORT_gongke_1
EXPORT_gongke_2
EXPORT_wenke_1
EXPORT_shangke_1
EXPORT_like_1
EXPORT_METADATA
```

## 🔧 使用流程

### 1. 初始设置
```bash
# 1. 部署到 Cloudflare Workers
wrangler deploy

# 2. 导出分类分页数据
curl -X POST https://your-worker.workers.dev/api/admin/export-categorized-data
```

### 2. 前端集成
```javascript
// 获取工科第1页数据
const response = await fetch('/api/exported-data/gongke/1');
const data = await response.json();

if (data.success) {
  console.log(`获取到 ${data.count} 条工科海报`);
  data.posters.forEach(poster => {
    console.log(poster.title);
  });
}
```

### 3. 分页导航
```javascript
// 获取元数据了解总页数
const metadataResponse = await fetch('/api/exported-data/metadata');
const metadata = await metadataResponse.json();

const gongkePages = metadata.metadata.categories.gongke.pages;
console.log(`工科分类共有 ${gongkePages} 页`);

// 遍历所有页面
for (let page = 1; page <= gongkePages; page++) {
  const pageResponse = await fetch(`/api/exported-data/gongke/${page}`);
  const pageData = await pageResponse.json();
  // 处理页面数据
}
```

## 📊 性能优化

### 优势
1. **按需加载**：只加载当前需要的页面数据
2. **缓存友好**：每页数据独立缓存
3. **带宽优化**：减少单次传输的数据量
4. **用户体验**：更快的页面加载速度

### 建议
1. 在前端实现分页缓存
2. 预加载下一页数据
3. 使用 CDN 缓存静态数据
4. 定期更新导出数据

## 🛠️ 维护

### 数据更新
当海报数据发生变化时，需要重新导出：
```bash
curl -X POST https://your-worker.workers.dev/api/admin/export-categorized-data
```

### 清理旧数据
定期清理导出的数据以节省存储空间：
```bash
curl -X DELETE https://your-worker.workers.dev/api/admin/exported-data
```

## 📝 注意事项

1. **数据一致性**：导出数据是快照，不会自动同步原始数据的变化
2. **存储限制**：注意 KV 存储的容量限制
3. **API 限制**：注意 Cloudflare Workers 的请求限制
4. **错误处理**：前端需要处理 API 错误情况

## 🔍 故障排除

### 常见问题

**Q: 导出失败怎么办？**
A: 检查 KV 存储空间和权限设置

**Q: 数据不完整怎么办？**
A: 重新调用导出 API

**Q: 前端加载慢怎么办？**
A: 检查网络连接，考虑使用 CDN

**Q: 如何验证数据正确性？**
A: 对比原始数据和导出数据的记录数量 