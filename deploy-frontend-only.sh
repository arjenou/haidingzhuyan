#!/bin/bash
# 构建前端
npm run build

# 这个脚本仅构建前端，不会尝试部署后端
echo "前端构建完成，可以通过Cloudflare Pages部署" 