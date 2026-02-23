#!/bin/bash
# Cognitive-OS 批量导入脚本
# 在 Git Bash 或 WSL 中运行

cd "$(dirname "$0")"

echo "═══════════════════════════════════════"
echo "Cognitive-OS 批量导入"
echo "═══════════════════════════════════════"

# 导入今天的
echo ""
echo "📥 导入今天的 sessions..."
node core/auto-importer.js --today

echo ""
echo "📊 生成偏好报告..."
node core/auto-importer.js --stats

echo ""
echo "🧠 生成认知报告..."
node core/bootstrap.js

echo ""
echo "═══════════════════════════════════════"
echo "✅ 全部完成！"
echo "═══════════════════════════════════════"
