#!/bin/bash
# 构建前端
echo "开始构建前端应用..."
npm run build

# 创建_routes.json文件（如果不存在）
if [ ! -f "dist/_routes.json" ]; then
  echo "创建_routes.json文件..."
  cat > dist/_routes.json << EOF
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/build/*", "/static/*", "/images/*", "/assets/*"],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
EOF
fi

# 使用Wrangler CLI部署到Cloudflare Pages
echo "开始部署到Cloudflare Pages..."
npx wrangler pages deploy dist --project-name=xinhangdao

echo "部署完成！请在Cloudflare控制台设置环境变量。"
echo "名称: VITE_API_BASE_URL"
echo "值: https://xinhangdao-api.wangyunjie1101.workers.dev/api" 