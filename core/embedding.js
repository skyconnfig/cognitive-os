/**
 * Embedding Utility - 文本向量化工具
 * 
 * 核心职责：
 * - 调用本地 Ollama API 生成文本嵌入向量
 * - 提供异步接口供其他模块使用
 */

const http = require('http');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const EMBEDDING_MODEL = 'all-minilm:latest';

/**
 * 获取单个文本的 Embedding
 * @param {string} text 待向量化的文本
 * @returns {Promise<number[]>} 向量数组
 */
async function getEmbedding(text) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: EMBEDDING_MODEL,
            prompt: text
        });

        const options = {
            hostname: OLLAMA_HOST,
            port: OLLAMA_PORT,
            path: '/api/embeddings',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30s timeout
        };

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Ollama API error: ${res.statusCode} - ${responseBody}`));
                }
                try {
                    const result = JSON.parse(responseBody);
                    resolve(result.embedding);
                } catch (e) {
                    reject(new Error(`Failed to parse Ollama response: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            if (e.code === 'ECONNREFUSED') {
                reject(new Error('Ollama connection refused. Please ensure Ollama is running and model "all-minilm" is installed.'));
            } else {
                reject(e);
            }
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Ollama API timeout (30s)'));
        });

        req.write(data, 'utf-8');
        req.end();
    });
}

/**
 * 批量获取 Embeddings (简单实现，逐个请求)
 * @param {string[]} texts 
 */
async function getEmbeddings(texts) {
    const results = [];
    for (const text of texts) {
        results.push(await getEmbedding(text));
    }
    return results;
}

module.exports = {
    getEmbedding,
    getEmbeddings
};
