#!/bin/bash
# 构建前端
npm run build

# 你可以在这里添加上传到Cloudflare Pages的命令
# 例如，如果使用Wrangler CLI：
# npx wrangler pages publish dist 