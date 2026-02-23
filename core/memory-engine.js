/**
 * Memory Engine - 长期记忆引擎
 * 
 * 核心职责：
 * - 维护本地向量索引 (JSON 格式)
 * - 提供语义搜索能力
 * - 自动同步 timeline 数据到索引
 */

const fs = require('fs');
const path = require('path');
const embedding = require('./embedding');

const VECTOR_STORE_FILE = path.join(__dirname, 'memory', 'vectors.json');
const TIMELINE_DIR = path.join(__dirname, 'memory', 'timeline');

/**
 * 余弦相似度计算
 */
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class MemoryEngine {
    constructor() {
        this.indexData = [];
        this.load();
    }

    load() {
        if (fs.existsSync(VECTOR_STORE_FILE)) {
            try {
                this.indexData = JSON.parse(fs.readFileSync(VECTOR_STORE_FILE, 'utf-8'));
            } catch (e) {
                console.error('[MemoryEngine] 加载索引失败:', e.message);
                this.indexData = [];
            }
        }
    }

    save() {
        const dir = path.dirname(VECTOR_STORE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(VECTOR_STORE_FILE, JSON.stringify(this.indexData, null, 2), 'utf-8');
    }

    /**
     * 添加记录到索引
     * @param {string} id 唯一标识 (如文件名_类型_索引)
     * @param {string} text 文本内容
     * @param {object} metadata 原始元数据
     */
    async add(id, text, metadata) {
        // 检查是否已存在
        const existingIndex = this.indexData.findIndex(item => item.id === id);

        try {
            const vector = await embedding.getEmbedding(text);
            const entry = { id, text, metadata, vector, timestamp: new Date().toISOString() };

            if (existingIndex > -1) {
                this.indexData[existingIndex] = entry;
            } else {
                this.indexData.push(entry);
            }
            return true;
        } catch (e) {
            console.error(`[MemoryEngine] 向量化失败 [${id}]:`, e.message);
            return false;
        }
    }

    /**
     * 语义搜索
     * @param {string} query 查询文本
     * @param {number} topK 返回结果数量
     */
    async search(query, topK = 5) {
        try {
            const queryVector = await embedding.getEmbedding(query);
            const results = this.indexData.map(item => ({
                ...item,
                similarity: cosineSimilarity(queryVector, item.vector)
            }));

            return results
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK)
                .map(({ vector, ...rest }) => rest); // 不返回向量数据减少体积
        } catch (e) {
            console.error('[MemoryEngine] 搜索失败:', e.message);
            return [];
        }
    }

    /**
     * 同步所有 timeline 记录
     */
    async sync() {
        console.log('[MemoryEngine] 开始同步全量记忆...');
        const files = fs.readdirSync(TIMELINE_DIR).filter(f => f.endsWith('.json'));
        let count = 0;

        for (const file of files) {
            const date = file.replace('.json', '');
            const content = JSON.parse(fs.readFileSync(path.join(TIMELINE_DIR, file), 'utf-8'));

            // 1. 索引主话题
            if (content.main_topic) {
                if (await this.add(`${date}_topic`, content.main_topic, { date, type: 'topic' })) count++;
            }

            // 2. 索引决策
            for (let i = 0; i < (content.decisions || []).length; i++) {
                const d = content.decisions[i];
                if (await this.add(`${date}_decision_${i}`, `${d.decision} (背景: ${d.context})`, { date, type: 'decision' })) count++;
            }

            // 3. 索引错误
            for (let i = 0; i < (content.mistakes || []).length; i++) {
                const m = content.mistakes[i];
                if (await this.add(`${date}_mistake_${i}`, `${m.mistake} (类型: ${m.type})`, { date, type: 'mistake' })) count++;
            }

            // 4. 索引洞见
            for (let i = 0; i < (content.insights || []).length; i++) {
                const ins = content.insights[i];
                const text = typeof ins === 'string' ? ins : ins.insight;
                if (await this.add(`${date}_insight_${i}`, text, { date, type: 'insight' })) count++;
            }
        }

        this.save();
        console.log(`[MemoryEngine] 同步完成，共索引 ${count} 条记录`);
        return count;
    }
}

// 单例模式
const engine = new MemoryEngine();

// CLI 支持
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args[0] === 'sync') {
        engine.sync().then(() => process.exit(0));
    } else if (args[0] === 'search' && args[1]) {
        engine.search(args.slice(1).join(' ')).then(results => {
            console.log('\n🔍 搜索结果:');
            results.forEach((r, i) => {
                console.log(`[${i + 1}] (${Math.round(r.similarity * 100)}%) ${r.metadata.date} [${r.metadata.type}]: ${r.text}`);
            });
            process.exit(0);
        });
    } else {
        console.log('Usage: node memory-engine.js [sync|search "query"]');
    }
}

module.exports = engine;
