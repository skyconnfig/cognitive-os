/**
 * OpenCode Session Importer (v2)
 * 
 * 功能：从 OpenCode 导入 session 数据到 Cognitive-OS
 * 
 * 使用方式：
 *   node importer-v2.js --import-all    导入所有 session
 *   node importer-v2.js --latest        导入最新 session
 *   node importer-v2.js --stats        生成偏好报告
 * 
 * 原理：直接调用 OpenCode API 获取 session 数据
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const reflectionEngine = require('./reflection-engine');
const stateManager = require('./state-manager');
const memoryEngine = require('./memory-engine');

// 尝试多个可能的 OpenCode 数据目录
const SEARCH_PATHS = [
  path.join(process.env.APPDATA || '', 'opencode'),
  path.join(process.env.APPDATA || '', 'Code', 'opencode'),
  path.join(process.env.LOCALAPPDATA || '', 'opencode'),
  path.join(process.env.HOME || '', '.opencode'),
  path.join(process.env.HOME || '', 'Library', 'Application Support', 'opencode'),
];

/**
 * 查找 OpenCode 数据目录
 */
function findOpenCodeDir() {
  for (const p of SEARCH_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * 使用 OpenCode CLI 获取 sessions
 */
function getSessionsViaCLI() {
  try {
    // 尝试使用 opencode sessions list 命令
    const result = execSync('opencode sessions list --json 2>/dev/null || echo "[]"', {
      encoding: 'utf-8',
      timeout: 10000
    });
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

/**
 * 手动解析 session 数据
 */
function getSessionsFromFiles() {
  const opencodeDir = findOpenCodeDir();
  if (!opencodeDir) {
    console.log('[Importer] 未找到 OpenCode 数据目录');
    return [];
  }

  // 尝试多个可能的 session 目录
  const sessionDirs = [
    path.join(opencodeDir, 'sessions'),
    path.join(opencodeDir, 'data', 'sessions'),
    path.join(opencodeDir, 'user', 'sessions'),
  ];

  for (const dir of sessionDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        return files.map(f => ({
          id: f.replace('.json', ''),
          path: path.join(dir, f)
        }));
      } catch (e) {
        console.log('[Importer] 读取失败:', dir);
      }
    }
  }

  return [];
}

/**
 * 加载 session 数据
 */
function loadSession(sessionId) {
  // 先尝试用 session_read 工具
  try {
    // 这里我们手动构建一个简化的 session 对象
    // 实际使用时会通过 session_list 获取
    return { id: sessionId, manual: true };
  } catch (e) {
    return null;
  }
}

/**
 * 从 session 消息中提取信息
 */
function extractFromSession(sessionData) {
  const insights = {
    topics: [],
    errors: [],
    decisions: [],
    tools: [],
    messageCount: 0,
    keywords: []
  };

  // 错误关键词
  const errorKeywords = ['error', 'failed', 'bug', '问题', '错误', '修复', 'fix'];
  // 决策关键词  
  const decisionKeywords = ['决定', '选择', '用', '采用', '决定用', 'choose', 'decide', 'use'];
  // 工具关键词
  const toolKeywords = ['read', 'write', 'edit', 'grep', 'glob', 'bash', 'task', 'git'];

  // 简化版：从 session 内容中提取
  // 实际应该解析 session.messages

  return insights;
}

/**
 * 从 messages 提取信息（基于 session_read 结果格式）
 */
function extractInsights(messages) {
  const insights = {
    topics: [],
    errors: [],
    decisions: [],
    tools: [],
    files: [],
    messageCount: messages?.length || 0
  };

  if (!messages || !Array.isArray(messages)) return insights;

  const content = JSON.stringify(messages).toLowerCase();

  // 提取错误
  const errorPatterns = ['error', 'failed', 'bug', '问题', '错误', '修复', 'fix'];
  for (const p of errorPatterns) {
    if (content.includes(p)) {
      insights.errors.push(p);
    }
  }

  // 提取决策
  const decisionPatterns = ['决定', '选择', '用', '采用', 'choose', 'use'];
  for (const p of decisionPatterns) {
    if (content.includes(p)) {
      insights.decisions.push(p);
    }
  }

  // 提取工具使用
  const toolPatterns = ['read', 'write', 'edit', 'grep', 'glob', 'bash', 'task', 'git', 'commit'];
  for (const p of toolPatterns) {
    if (content.includes(p)) {
      insights.tools.push(p);
    }
  }

  // 提取文件扩展名
  const extMatches = content.match(/\.([a-z]+)"/g) || [];
  insights.files = [...new Set(extMatches.map(e => e.replace('"', '')))];

  // 提取话题（第一句话）
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (firstUserMsg && firstUserMsg.content) {
    insights.topics.push(firstUserMsg.content.substring(0, 100));
  }

  // 去重
  insights.errors = [...new Set(insights.errors)];
  insights.decisions = [...new Set(insights.decisions)];
  insights.tools = [...new Set(insights.tools)];

  return insights;
}

/**
 * 导入 session
 */
function importSession(messages, sessionId = 'unknown') {
  console.log(`\n[Importer] 导入 session: ${sessionId}`);

  const insights = extractInsights(messages);

  console.log(`  • 消息数: ${insights.messageCount}`);
  console.log(`  • 话题: ${insights.topics.length}`);
  console.log(`  • 错误关键词: ${insights.errors.length}`);
  console.log(`  • 决策关键词: ${insights.decisions.length}`);
  console.log(`  • 工具: ${insights.tools.length}`);

  // 记录话题
  if (insights.topics.length > 0) {
    reflectionEngine.setMainTopic(insights.topics[0]);
  }

  // 记录错误
  for (const error of insights.errors.slice(0, 3)) {
    reflectionEngine.addMistake(error, '使用问题');
  }

  // 记录工具偏好
  if (insights.tools.length > 0) {
    const toolSummary = `常用工具: ${insights.tools.slice(0, 5).join(', ')}`;
    reflectionEngine.addInsight(toolSummary);
  }

  // 记录文件类型偏好
  if (insights.files.length > 0) {
    const fileSummary = `常用文件类型: ${insights.files.slice(0, 5).join(', ')}`;
    reflectionEngine.addInsight(fileSummary);
  }

  // 根据消息数量设置精力状态
  if (insights.messageCount > 30) {
    reflectionEngine.setEnergyState('high');
  } else if (insights.messageCount > 10) {
    reflectionEngine.setEnergyState('neutral');
  } else {
    reflectionEngine.setEnergyState('low');
  }


  // 索引到长期记忆
  const sessionText = `Topic: ${insights.topics[0] || 'Unknown'} | Tools: ${insights.tools.join(', ')} | Files: ${insights.files.join(', ')}`;
  memoryEngine.add(`session_${sessionId}`, sessionText, { type: 'session', sessionId, date: new Date().toISOString().split('T')[0] })
    .then(() => memoryEngine.save())
    .catch(e => console.error('[Importer] 记忆索引失败:', e.message));

  console.log('  ✅ 完成');

  return insights;
}

/**
 * 生成偏好报告
 */
function generatePreferenceReport(allInsights) {
  const toolCount = {};
  const fileCount = {};
  const errorCount = {};

  for (const insights of allInsights) {
    for (const t of insights.tools) {
      toolCount[t] = (toolCount[t] || 0) + 1;
    }
    for (const f of insights.files) {
      fileCount[f] = (fileCount[f] || 0) + 1;
    }
    for (const e of insights.errors) {
      errorCount[e] = (errorCount[e] || 0) + 1;
    }
  }

  let report = '\n═══════════════════════════════════════\n';
  report += '📊 OpenCode 偏好分析报告\n';
  report += '═══════════════════════════════════════\n\n';

  // 常用工具
  report += '【常用工具 Top 10】\n';
  Object.entries(toolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([t, c]) => report += `  • ${t}: ${c} 次\n`);
  report += '\n';

  // 文件类型
  report += '【常用文件类型】\n';
  Object.entries(fileCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([f, c]) => report += `  • ${f}: ${c} 次\n`);
  report += '\n';

  // 常见问题
  if (Object.keys(errorCount).length > 0) {
    report += '【常见问题类型】\n';
    Object.entries(errorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([e, c]) => report += `  • ${e}: ${c} 次\n`);
    report += '\n';
  }

  report += '═══════════════════════════════════════\n';

  return report;
}

// 手动导入函数（供外部调用）
async function importFromSessionList(sessionIds) {
  const allInsights = [];

  for (const sessionId of sessionIds) {
    try {
      // 尝试通过多种方式获取 session 数据
      // 方式 1: 读取文件
      const sessions = getSessionsFromFiles();
      const session = sessions.find(s => s.id === sessionId);

      if (session && fs.existsSync(session.path)) {
        const data = JSON.parse(fs.readFileSync(session.path, 'utf-8'));
        const insights = importSession(data.messages || [], sessionId);
        allInsights.push(insights);
      } else {
        console.log(`[Importer] Session 文件未找到: ${sessionId}`);
      }
    } catch (e) {
      console.error(`[Importer] 导入失败 ${sessionId}:`, e.message);
    }
  }

  return allInsights;
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);

  console.log('═══════════════════════════════════════');
  console.log('OpenCode Session Importer v2');
  console.log('═══════════════════════════════════════\n');

  if (args.includes('--list')) {
    const sessions = getSessionsFromFiles();
    console.log(`找到 ${sessions.length} 个 sessions:\n`);
    sessions.slice(0, 20).forEach(s => {
      console.log(`  ${s.id}`);
    });
  } else if (args.includes('--latest')) {
    const sessions = getSessionsFromFiles();
    if (sessions.length > 0) {
      const latest = sessions[0];
      console.log('导入最新 session:', latest.id);
      if (fs.existsSync(latest.path)) {
        const data = JSON.parse(fs.readFileSync(latest.path, 'utf-8'));
        importSession(data.messages || [], latest.id);
      }
    }
  } else if (args.includes('--import-all')) {
    const sessions = getSessionsFromFiles();
    console.log(`导入 ${sessions.length} 个 sessions...\n`);
    const allInsights = [];

    for (const s of sessions) {
      try {
        if (fs.existsSync(s.path)) {
          const data = JSON.parse(fs.readFileSync(s.path, 'utf-8'));
          const insights = importSession(data.messages || [], s.id);
          allInsights.push(insights);
        }
      } catch (e) {
        console.error(`[Importer] 失败: ${s.id}`, e.message);
      }
    }

    console.log(generatePreferenceReport(allInsights));
  } else if (args.includes('--stats')) {
    const sessions = getSessionsFromFiles();
    const allInsights = [];

    for (const s of sessions.slice(0, 30)) {
      try {
        if (fs.existsSync(s.path)) {
          const data = JSON.parse(fs.readFileSync(s.path, 'utf-8'));
          allInsights.push(extractInsights(data.messages || []));
        }
      } catch (e) {
        // 忽略
      }
    }

    console.log(generatePreferenceReport(allInsights));
  } else {
    console.log('Usage:');
    console.log('  node importer-v2.js --list         列出 sessions');
    console.log('  node importer-v2.js --latest      导入最新');
    console.log('  node importer-v2.js --import-all  导入全部');
    console.log('  node importer-v2.js --stats       生成偏好报告');
  }
}

module.exports = {
  getSessionsFromFiles,
  extractInsights,
  importSession,
  importFromSessionList,
  generatePreferenceReport
};
