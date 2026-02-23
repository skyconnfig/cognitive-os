/**
 * OpenCode Session Importer
 * 
 * 功能：从 OpenCode session 导入数据到 Cognitive-OS
 * 
 * 使用方式：
 *   node importer.js <session_id>
 *   node importer.js --latest
 *   node importer.js --all
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const reflectionEngine = require('./reflection-engine');
const stateManager = require('./state-manager');

// OpenCode sessions 目录（根据平台调整）
const SESSIONS_DIR = process.platform === 'win32' 
  ? path.join(process.env.APPDATA || '', 'opencode', 'sessions')
  : path.join(process.env.HOME || '', '.opencode', 'sessions');

/**
 * 获取 session 列表
 */
function getSessionList() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        id: f.replace('.json', ''),
        path: path.join(SESSIONS_DIR, f),
        mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch (e) {
    console.error('[Importer] 无法读取 sessions 目录:', e.message);
    return [];
  }
}

/**
 * 加载 session 数据
 */
function loadSession(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  
  if (!fs.existsSync(sessionPath)) {
    console.error(`[Importer] Session 不存在: ${sessionId}`);
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    return data;
  } catch (e) {
    console.error('[Importer] 解析失败:', e.message);
    return null;
  }
}

/**
 * 提取关键信息
 */
function extractInsights(sessionData) {
  const insights = {
    topics: [],
    errors: [],
    decisions: [],
    files: [],
    tools: [],
    duration: 0,
    messageCount: 0
  };
  
  if (!sessionData) return insights;
  
  // 提取消息数量
  insights.messageCount = sessionData.messages?.length || 0;
  
  // 提取文件路径
  if (sessionData.messages) {
    for (const msg of sessionData.messages) {
      // 提取用户提到的文件
      const content = JSON.stringify(msg);
      const fileMatches = content.match(/[a-zA-Z]:\\[\w\\]+\.\w+/g) || 
                        content.match(/\/[\w\/]+\.\w+/g);
      if (fileMatches) {
        insights.files.push(...fileMatches);
      }
    }
  }
  
  // 提取工具使用
  if (sessionData.messages) {
    const toolPatterns = [
      'read', 'write', 'edit', 'grep', 'glob', 'bash', 'task',
      'lsp_', 'ast_grep', 'websearch', 'webfetch'
    ];
    
    for (const msg of sessionData.messages) {
      if (msg.role === 'assistant') {
        const content = msg.content || '';
        for (const pattern of toolPatterns) {
          if (content.includes(pattern)) {
            insights.tools.push(pattern);
          }
        }
      }
    }
  }
  
  // 提取话题（从第一条用户消息）
  if (sessionData.messages && sessionData.messages.length > 0) {
    const firstUserMsg = sessionData.messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      // 取前 100 个字符作为话题
      const content = firstUserMsg.content?.substring(0, 100) || '';
      insights.topics.push(content);
    }
  }
  
  // 计算时长（如果有时间戳）
  if (sessionData.created_at && sessionData.last_active_at) {
    const start = new Date(sessionData.created_at);
    const end = new Date(sessionData.last_active_at);
    insights.duration = Math.round((end - start) / 1000 / 60); // 分钟
  }
  
  // 去重
  insights.files = [...new Set(insights.files)];
  insights.tools = [...new Set(insights.tools)];
  
  return insights;
}

/**
 * 识别错误模式
 */
function identifyErrors(sessionData) {
  const errors = [];
  
  if (!sessionData?.messages) return errors;
  
  // 常见的错误关键词
  const errorKeywords = [
    'error', 'failed', 'cannot', 'undefined', 'null', 
    'not found', 'permission denied', 'timeout',
    'TypeError', 'ReferenceError', 'SyntaxError'
  ];
  
  for (const msg of sessionData.messages) {
    if (msg.role === 'user') {
      const content = msg.content?.toLowerCase() || '';
      
      for (const keyword of errorKeywords) {
        if (content.includes(keyword)) {
          // 尝试提取更具体的错误描述
          const idx = content.indexOf(keyword);
          const context = msg.content?.substring(Math.max(0, idx - 20), idx + 50) || '';
          errors.push({
            keyword,
            context: context.trim(),
            message: msg.content?.substring(0, 200)
          });
        }
      }
    }
  }
  
  return errors;
}

/**
 * 识别决策
 */
function identifyDecisions(sessionData) {
  const decisions = [];
  
  if (!sessionData?.messages) return decisions;
  
  // 决策关键词
  const decisionKeywords = [
    '决定', '选择', '用', '采用', '决定用',
    'choose', 'decide', 'use', 'adopt', 'go with'
  ];
  
  for (const msg of sessionData.messages) {
    if (msg.role === 'user') {
      const content = msg.content || '';
      
      for (const keyword of decisionKeywords) {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          decisions.push({
            decision: content.substring(0, 200),
            keyword
          });
        }
      }
    }
  }
  
  return decisions;
}

/**
 * 导入单个 session
 */
function importSession(sessionId) {
  console.log(`\n[Importer] 正在导入 session: ${sessionId}`);
  
  const sessionData = loadSession(sessionId);
  if (!sessionData) return false;
  
  const insights = extractInsights(sessionData);
  const errors = identifyErrors(sessionData);
  const decisions = identifyDecisions(sessionData);
  
  console.log(`  • 消息数: ${insights.messageCount}`);
  console.log(`  • 文件数: ${insights.files.length}`);
  console.log(`  • 工具使用: ${insights.tools.length}`);
  console.log(`  • 错误数: ${errors.length}`);
  console.log(`  • 决策数: ${decisions.length}`);
  
  // 记录到 Cognitive-OS
  if (insights.topics.length > 0) {
    reflectionEngine.setMainTopic(insights.topics[0]);
  }
  
  // 记录决策
  for (const decision of decisions.slice(0, 3)) {
    reflectionEngine.addDecision(decision.decision, `keyword: ${decision.keyword}`);
  }
  
  // 记录错误
  for (const error of errors.slice(0, 3)) {
    const type = categorizeError(error.keyword);
    reflectionEngine.addMistake(error.context || error.keyword, type);
  }
  
  // 记录工具偏好
  if (insights.tools.length > 0) {
    const toolSummary = `使用的工具: ${insights.tools.join(', ')}`;
    reflectionEngine.addInsight(toolSummary);
  }
  
  // 根据 session 质量设置精力状态
  if (insights.messageCount > 20) {
    reflectionEngine.setEnergyState('high');
  } else if (insights.messageCount > 5) {
    reflectionEngine.setEnergyState('neutral');
  } else {
    reflectionEngine.setEnergyState('low');
  }
  
  // 更新状态
  stateManager.updateState({
    streak_days: (stateManager.getState().streak_days || 0) + 1
  });
  
  console.log('  ✅ 导入完成');
  
  return true;
}

/**
 * 错误分类
 */
function categorizeError(keyword) {
  const categories = {
    'error': '运行时错误',
    'failed': '执行失败',
    'cannot': '权限/能力问题',
    'undefined': '未定义错误',
    'not found': '资源缺失',
    'permission denied': '权限问题',
    'timeout': '超时',
    'TypeError': '类型错误',
    'ReferenceError': '引用错误',
    'SyntaxError': '语法错误'
  };
  
  return categories[keyword] || '其他问题';
}

/**
 * 生成偏好报告
 */
function generatePreferenceReport(sessions) {
  const allTools = {};
  const allFiles = {};
  const allErrors = {};
  
  for (const sessionId of sessions) {
    const data = loadSession(sessionId);
    if (!data) continue;
    
    const insights = extractInsights(data);
    
    for (const tool of insights.tools) {
      allTools[tool] = (allTools[tool] || 0) + 1;
    }
    
    for (const file of insights.files) {
      const ext = path.extname(file);
      allFiles[ext] = (allFiles[ext] || 0) + 1;
    }
  }
  
  let report = '\n═══════════════════════════════════════\n';
  report += '📊 偏好分析报告\n';
  report += '═══════════════════════════════════════\n\n';
  
  // 常用工具
  report += '【常用工具 Top 10】\n';
  const topTools = Object.entries(allTools)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [tool, count] of topTools) {
    report += `  • ${tool}: ${count} 次\n`;
  }
  report += '\n';
  
  // 文件类型
  report += '【常用文件类型】\n';
  const topFiles = Object.entries(allFiles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [ext, count] of topFiles) {
    report += `  • ${ext}: ${count} 次\n`;
  }
  report += '\n';
  
  report += '═══════════════════════════════════════\n';
  
  return report;
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node importer.js <session_id>    导入单个 session');
    console.log('  node importer.js --latest      导入最新 session');
    console.log('  node importer.js --all          导入所有 session');
    console.log('  node importer.js --list        列出所有 session');
    console.log('  node importer.js --stats        生成偏好报告');
    process.exit(0);
  }
  
  if (args[0] === '--list') {
    const sessions = getSessionList();
    console.log(`\n找到 ${sessions.length} 个 sessions:\n`);
    for (const s of sessions.slice(0, 20)) {
      console.log(`  ${s.id}  (${s.mtime.toLocaleDateString()})`);
    }
    process.exit(0);
  }
  
  if (args[0] === '--stats') {
    const sessions = getSessionList();
    const ids = sessions.slice(0, 30).map(s => s.id);
    console.log(generatePreferenceReport(ids));
    process.exit(0);
  }
  
  if (args[0] === '--latest') {
    const sessions = getSessionList();
    if (sessions.length > 0) {
      importSession(sessions[0].id);
    } else {
      console.log('没有找到 sessions');
    }
    process.exit(0);
  }
  
  if (args[0] === '--all') {
    const sessions = getSessionList();
    console.log(`将导入 ${sessions.length} 个 sessions...`);
    for (const s of sessions) {
      importSession(s.id);
    }
    console.log('\n✅ 全部导入完成');
    console.log(generatePreferenceReport(sessions.map(s => s.id)));
    process.exit(0);
  }
  
  // 导入指定 session
  importSession(args[0]);
}

module.exports = {
  getSessionList,
  loadSession,
  extractInsights,
  importSession,
  generatePreferenceReport
};
