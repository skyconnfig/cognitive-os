/**
 * Memory CLI - 记忆搜索命令行工具
 * 
 * 使用方式：
 *   node core/memory-cli.js "如何解决数据库连接超时"
 */

const memoryEngine = require('./memory-engine');

async function main() {
    const query = process.argv.slice(2).join(' ');

    if (!query) {
        console.log('Usage: node core/memory-cli.js "your search query"');
        process.exit(1);
    }

    console.log(`\n🧠 正在检索与 "${query}" 相关的记忆...\n`);

    const results = await memoryEngine.search(query, 5);

    if (results.length === 0) {
        console.log('❌ 未找到匹配的记忆。');
        console.log('💡 提示: 尝试运行 `node core/memory-engine.js sync` 同步索引。');
        process.exit(0);
    }

    results.forEach((r, i) => {
        const simPercent = Math.round(r.similarity * 100);
        console.log(`[${i + 1}] 【${simPercent}% 相关】 ${r.metadata.date || 'Unknown Date'} [${r.metadata.type}]`);
        console.log(`    内容: ${r.text}`);
        if (r.metadata.sessionId) {
            console.log(`    Session ID: ${r.metadata.sessionId}`);
        }
        console.log('');
    });
}

main().catch(e => {
    console.error('❌ 搜索过程中发生错误:', e.message);
    process.exit(1);
});
