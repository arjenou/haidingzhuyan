#!/bin/bash

# Cloudflare KV中URL批量替换脚本 (兼容版)
#
# 功能:
#   - 直接使用 wrangler.toml 中定义的 binding 名称来操作KV
#   - 遍历指定的KV命名空间
#   - 查找所有包含旧域名的记录
#   - 将旧域名替换为新域名
#   - 将更新后的数据写回KV

# --- 配置 ---
OLD_DOMAIN="xinhangdao-api.wangyunjie1101.workers.dev"
NEW_DOMAIN="api.capstoneketi.com"
# wrangler.toml 文件的路径
CONFIG_FILE="backend/wrangler.toml"

# --- KV 绑定名称 (Binding Names) ---
# 这些必须与 wrangler.toml 中定义的 `binding` 完全一致
POSTER_METADATA_BINDING="POSTER_METADATA"
POSTER_METADATA_PAGES_BINDING="POSTER_METADATA_PAGES"

# --- 依赖检查 ---
if ! command -v jq &> /dev/null; then
    echo "错误: 未检测到 jq。" >&2
    exit 1
fi
if ! command -v npx &> /dev/null; then
    echo "错误: 未检测到 npx。" >&2
    exit 1
fi
echo "✅ 依赖检查通过。"

# --- 主函数 ---
#
# @param $1: 命名空间的可读名称 (用于日志输出)
# @param $2: 在 wrangler.toml 中定义的 binding 名称
#
function process_namespace() {
    local ns_name=$1
    local binding_name=$2
    
    echo -e "\n\n======================================================="
    echo "🔍 开始处理命名空间: $ns_name (Binding: $binding_name)"
    echo "======================================================="

    # 使用 binding 名称获取所有键
    local keys=$(npx wrangler kv:key list --binding "$binding_name" --config "$CONFIG_FILE" --format json | jq -r '.[].name')

    if [ -z "$keys" ]; then
        echo "命名空间 $ns_name 中没有找到任何键。跳过。"
        return
    fi

    local key_count=$(echo "$keys" | wc -l | xargs)
    echo "发现 $key_count 个键需要处理。"

    local processed_count=0
    local updated_count=0

    while IFS= read -r key; do
        ((processed_count++))
        echo -ne "[$processed_count/$key_count] 正在处理: $key ... "

        # 获取键对应的值
        local value=$(npx wrangler kv:key get "$key" --binding "$binding_name" --config "$CONFIG_FILE")
        
        if [[ "$value" == *"$OLD_DOMAIN"* ]]; then
            local new_value=${value//$OLD_DOMAIN/$NEW_DOMAIN}
            
            # 将更新后的值写回KV
            npx wrangler kv:key put "$key" --binding "$binding_name" --config "$CONFIG_FILE" --value "$new_value"
            
            echo "✅ 已更新"
            ((updated_count++))
        else
            echo "➖ 无需改动，已跳过"
        fi
    done <<< "$keys"

    echo -e "\n🎉 命名空间 $ns_name 处理完毕"
    echo "总共处理: $processed_count 个键"
    echo "总共更新: $updated_count 个键"
}

# --- 执行脚本 ---
process_namespace "POSTER_METADATA (海报主数据)" "$POSTER_METADATA_BINDING"
process_namespace "POSTER_METADATA_PAGES (缓存数据)" "$POSTER_METADATA_PAGES_BINDING"

echo -e "\n\n🚀 所有命名空间都已成功处理！"
echo "💡 重要提示: 作为最后的保险步骤，建议你再调用一次后端接口来重建所有缓存。"
echo "💡 运行此命令: curl -X POST https://api.capstoneketi.com/api/refactor-database" 