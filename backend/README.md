# 新航道 Cloudflare Workers API

基于Hono框架和Cloudflare Workers的后端API服务。

## 功能

- 海报上传到Cloudflare R2存储
- 获取海报URL
- 列出所有海报
- 删除海报

## 开发设置

### 前提条件

- Node.js 18+
- Cloudflare账号
- 配置好的R2存储桶

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

这将启动一个本地开发服务器，模拟Cloudflare Workers环境。

### 部署到Cloudflare

1. 登录到Cloudflare:

```bash
npx wrangler login
```

2. 部署Worker:

```bash
npm run deploy
```

## 环境变量配置

在`wrangler.toml`文件中配置以下变量:

- `R2_ENDPOINT`: R2存储桶的端点URL

## API端点

### 上传海报
- POST /api/upload-poster
- 请求: 带有"poster"字段的multipart/form-data表单

### 获取海报URL
- GET /api/get-poster-url/:key

### 列出所有海报
- GET /api/list-posters

### 删除海报
- DELETE /api/delete-poster/:key 