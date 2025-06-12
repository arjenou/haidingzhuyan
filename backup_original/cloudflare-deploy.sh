#!/bin/bash

# 这个脚本作为Cloudflare Pages部署命令
# 它故意空转以避免任何Worker部署

echo "前端构建已完成。不要尝试部署Worker。"
echo "如需部署Worker，请使用单独的命令：cd worker && npx wrangler deploy"

# 返回成功状态码
exit 0 