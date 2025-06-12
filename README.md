# 新航道项目

这个项目包含前端和后端代码，分别位于不同的目录中。

## 项目结构

```
xinHangdao/
├── frontend/             # 前端代码 (React + Vite)
│   ├── src/              # 源代码
│   ├── public/           # 静态资源
│   ├── dist/             # 构建输出
│   ├── package.json      # 前端依赖
│   └── ...               # 其他前端配置文件
│
├── backend/              # 后端代码
│   ├── src/              # Cloudflare Workers源代码 (Hono)
│   ├── server_old/       # 旧版Express后端代码
│   ├── package.json      # 后端依赖
│   └── ...               # 其他后端配置文件
│
└── DEPLOYMENT.md         # 部署说明
```

## 前端 (React + Vite)

前端使用React框架和Vite构建工具，部署在Cloudflare Pages上。

```bash
cd frontend
npm install
npm run dev     # 本地开发
npm run build   # 构建生产版本
```

## 后端 (Cloudflare Workers + Hono)

后端使用Hono框架，部署在Cloudflare Workers上。

```bash
cd backend
npm install
npm run dev     # 本地开发
npm run deploy  # 部署到Cloudflare Workers
```

## 部署

详细的部署说明请参考 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 功能

- 海报上传到Cloudflare R2存储
- 获取海报URL
- 列出所有海报
- 删除海报
