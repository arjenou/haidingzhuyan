# 部署指南

本项目分为前端和后端两部分，位于不同的目录中，需要分别部署。

## 前端部署（Cloudflare Pages）

前端代码位于`frontend`目录，使用Vite构建，并部署到Cloudflare Pages。

### 前端本地开发

```bash
cd frontend
npm install
npm run dev
```

### 通过Cloudflare控制台部署前端

1. 在Cloudflare控制台中创建一个新的Pages项目
2. 连接您的Git仓库
3. 配置构建设置：
   - 根目录：`frontend`（指定前端代码所在的子目录）
   - 构建命令：`npm run build:pages`
   - 构建输出目录：`dist`
   - **重要**：部署命令应设置为：`./cloudflare-deploy.sh`，或者完全留空
   - 环境变量：可根据需要添加

### 关于配置文件

前端目录包含以下配置文件：
- `.cfpages.yaml`：Cloudflare Pages配置文件
- `pages-wrangler.toml`：用于Pages环境的特殊wrangler配置，防止Worker部署
- `cloudflare-deploy.sh`：一个空的部署脚本，避免Pages尝试部署Worker

### 关于 `build:pages` 命令

这个命令会：
1. 编译TypeScript
2. 构建前端资源
3. 复制特殊的`pages-wrangler.toml`到`wrangler.toml`，以防止Pages自动尝试部署Worker
4. 创建一个标记文件，表明构建已完成

## 后端部署（Cloudflare Workers）

后端代码位于`backend`目录，使用Hono框架，并部署到Cloudflare Workers。

### 后端本地开发

```bash
cd backend
npm install
npm run dev
```

### 部署后端

```bash
cd backend
npx wrangler deploy
```

### 使用部署脚本

```bash
cd backend
./deploy-backend.sh
```

## API URL配置

前端的API URL配置在`frontend/vite.config.ts`文件中：

```typescript
define: {
  'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://xinhangdao-api.your-account.workers.dev/api')
}
```

部署后端后，请将此URL更新为您的实际Worker URL。

## 完整部署流程

1. 部署后端Worker
2. 获取Worker的URL
3. 更新`frontend/vite.config.ts`中的API URL
4. 部署前端到Pages

## 常见问题排查

1. **Pages部署错误："Missing entry-point to Worker script"**：
   - 确保您的部署命令设置为`./cloudflare-deploy.sh`或留空
   - 确保构建命令是`npm run build:pages`而不是简单的`npm run build`

2. **API连接错误**：
   - 检查`vite.config.ts`中的API URL是否正确
   - 确保Worker已正确部署并获得了正确的URL
   
3. **找不到根目录错误**：
   - 确保在Cloudflare Pages设置中指定了正确的根目录（`frontend`） 

   (base) wang.yunjie@mf-3714-mm02:~/Desktop/LiuShi/xinHangdao/frontend|main⚡ ⇒  curl -X POST https://xinhangdao-api.wangyunjie1101.workers.dev/api/admin/export-categorized-data

   curl -X POST https://xinhangdao-api.wangyunjie1101.workers.dev/api/build-search-indexes