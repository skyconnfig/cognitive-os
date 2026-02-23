/**
 * OpenCode Session Auto-Importer
 * 
 * 自动导入 OpenCode sessions 到 Cognitive-OS
 * 
 * 使用方式：
 *   node auto-importer.js              导入最新 session
 *   node auto-importer.js --all       导入所有 sessions
 *   node auto-importer.js --stats     生成偏好报告
 *   node auto-importer.js --today     导入今天的所有 sessions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reflectionEngine = require('./reflection-engine');
const stateManager = require('./state-manager');

const TEMP_FILE = path.join(__dirname, '..', 'temp-session.json');

/**
 * 获取 session 列表
 */
function getSessionList() {
  try {
    const output = execSync('opencode session list', {
      encoding: 'utf-8',
      timeout: 30000
    });
    
    const sessions = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // 跳过标题行和分隔线
      if (line.startsWith('Session') || line.startsWith('─') || !line.trim()) {
        continue;
      }
      
      // 解析: ses_xxx  Title  Updated
      const match = line.match(/^(ses_\w+)\s+(.+?)\s+(\d{2}:\d{2}(?:\s+·\s+\d{4}\/\d{1,2}\/\d{1,2})?)/);
      if (match) {
        sessions.push({
          id: match[1],
          title: match[2].trim(),
          updated: match[3].trim()
        });
      }
    }
    
    return sessions;
  } catch (e) {
    console.error('[AutoImporter] 获取列表失败:', e.message);
    return [];
  }
}

/**
 * 导出单个 session
 */
function exportSession(sessionId) {
  try {
    const output = execSync(`opencode export ${sessionId}`, {
      encoding: 'utf-8',
      timeout: 60000
    });
    
    // 去掉 "Exporting session:" 前缀
    const jsonStr = output.replace(/^Exporting session:.*\n/, '');
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`[AutoImporter] 导出失败 ${sessionId}:`, e.message);
    return null;
  }
}

/**
 * 从 messages 提取信息
 */
function extractInsights(data) {
  const insights = {
    sessionId: data.info?.id,
    title: data.info?.title,
    created: data.info?.time?.created,
    updated: data.info?.time?.updated,
    messages: [],
    tools: [],
    files: [],
    errors: [],
    decisions: [],
    topics: [],
    model: null,
    messageCount: 0
  };
  
  if (!data.messages) return insights;
  
  insights.messageCount = data.messages.length;
  
  // 获取使用的模型
  if (data.messages[0]?.info?.model) {
    insights.model = data.messages[0].info.model.modelID;
  }
  
  const allContent = JSON.stringify(data.messages).toLowerCase();
  
  // 工具关键词
  const toolPatterns = [
    'read', 'write', 'edit', 'grep', 'glob', 'bash', 'task', 
    'git', 'commit', 'push', 'lsp_', 'ast_grep', 'websearch', 'webfetch'
  ];
  for (const p of toolPatterns) {
    if (allContent.includes(p)) {
      insights.tools.push(p);
    }
  }
  
  // 文件扩展名
  const extPatterns = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.md', '.yaml', '.yml',
    '.html', '.css', '.scss', '.sql', '.sh', '.bash', '.go', '.rs', '.java'
  ];
  for (const p of extPatterns) {
    if (allContent.includes(p)) {
      insights.files.push(p.substring(1));
    }
  }
  
  // 错误关键词
  const errorPatterns = [
    'error', 'failed', 'bug', '问题', '错误', 'fix', 'fixing',
    'no payment', 'payment method', 'permission denied',
    'typeerror', 'referenceerror', 'syntaxerror'
  ];
  for (const p of errorPatterns) {
    if (allContent.includes(p)) {
      insights.errors.push(p);
    }
  }
  
  // 决策关键词
  const decisionPatterns = [
    '决定', '选择', '用', '采用', '决定用', 
    'choose', 'decide', 'use', 'adopt', 'go with', 'build', 'create'
  ];
  for (const p of decisionPatterns) {
    if (allContent.includes(p)) {
      insights.decisions.push(p);
    }
  }
  
  // 提取话题（第一条用户消息）
  for (const msg of data.messages) {
    if (msg.info?.role === 'user') {
      const text = JSON.stringify(msg.parts || []).toLowerCase();
      if (text.length > 20) {
        insights.topics.push(text.substring(0, 150));
        break;
      }
    }
  }
  
  // 去重
  insights.tools = [...new Set(insights.tools)];
  insights.files = [...new Set(insights.files)];
  insights.errors = [...new Set(insights.errors)];
  insights.decisions = [...new Set(insights.decisions)];
  
  return insights;
}

/**
 * 导入单个 session
 */
function importSession(data) {
  const insights = extractInsights(data);
  
  console.log(`\n📥 导入: ${insights.title || insights.sessionId}`);
  console.log(`   模型: ${insights.model || 'unknown'}`);
  console.log(`   消息: ${insights.messageCount}`);
  console.log(`   工具: ${insights.tools.slice(0, 5).join(', ')}`);
  console.log(`   文件: ${insights.files.slice(0, 5).join(', ')}`);
  
  // 记录话题
  if (insights.topics.length > 0) {
    const topic = insights.topics[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, ' ').trim();
    if (topic) {
      reflectionEngine.setMainTopic(topic.substring(0, 50));
    }
  }
  
  // 记录使用的模型
  if (insights.model) {
    reflectionEngine.addInsight(`使用模型: ${insights.model}`);
  }
  
  // 记录工具偏好
  if (insights.tools.length > 0) {
    reflectionEngine.addInsight(`常用工具: ${insights.tools.slice(0, 5).join(', ')}`);
  }
  
  // 记录文件类型偏好
  if (insights.files.length > 0) {
    reflectionEngine.addInsight(`常用文件: ${insights.files.slice(0, 5).join(', ')}`);
  }
  
  // 记录错误
  for (const error of insights.errors.slice(0, 2)) {
    reflectionEngine.addMistake(error, 'session问题');
  }
  
  // 记录决策
  for (const decision of insights.decisions.slice(0, 2)) {
    reflectionEngine.addDecision(decision, 'session提取');
  }
  
  // 根据消息数量设置精力
  if (insights.messageCount > 30) {
    reflectionEngine.setEnergyState('high');
  } else if (insights.messageCount > 10) {
    reflectionEngine.setEnergyState('neutral');
  } else {
    reflectionEngine.setEnergyState('low');
  }
  
  console.log('   ✅ 完成');
  
  return insights;
}

/**
 * 导入最新的 session
 */
function importLatest() {
  console.log('📋 获取 session 列表...');
  const sessions = getSessionList();
  
  if (sessions.length === 0) {
    console.log('没有找到 sessions');
    return;
  }
  
  console.log(`找到 ${sessions.length} 个 sessions`);
  
  const latest = sessions[0];
  console.log(`\n🔄 导入最新: ${latest.title}`);
  
  const data = exportSession(latest.id);
  if (data) {
    importSession(data);
  }
}

/**
 * 导入今天的所有 sessions
 */
function importToday() {
  console.log('📋 获取今日 sessions...');
  const sessions = getSessionList();
  
  const today = new Date();
  const todayStr = today.toLocaleDateString('zh-CN');
  
  const todaySessions = sessions.filter(s => s.updated.includes(todayStr));
  
  if (todaySessions.length === 0) {
    console.log('今天没有 sessions');
    return;
  }
  
  console.log(`今日找到 ${todaySessions.length} 个 sessions\n`);
  
  for (const session of todaySessions) {
    const data = exportSession(session.id);
    if (data) {
      importSession(data);
    }
  }
}

/**
 * 导入所有 sessions（限制数量）
 */
function importAll(limit = 20) {
  console.log(`📋 获取 sessions (限制 ${limit})...`);
  const sessions = getSessionList();
  
  const toImport = sessions.slice(0, limit);
  console.log(`将导入 ${toImport.length} 个 sessions\n`);
  
  const allInsights = [];
  
  for (const session of toImport) {
    const data = exportSession(session.id);
    if (data) {
      const insights = importSession(data);
      allInsights.push(insights);
    }
  }
  
  console.log(generateReport(allInsights));
}

/**
 * 生成偏好报告
 */
function generateReport(allInsights) {
  const toolCount = {};
  const fileCount = {};
  const errorCount = {};
  const modelCount = {};
  
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
    if (insights.model) {
      modelCount[insights.model] = (modelCount[insights.model] || 0) + 1;
    }
  }
  
  let report = '\n═══════════════════════════════════════\n';
  report += '📊 OpenCode 偏好分析报告\n';
  report += '═══════════════════════════════════════\n\n';
  
  // 常用模型
  if (Object.keys(modelCount).length > 0) {
    report += '【常用模型】\n';
    Object.entries(modelCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([m, c]) => report += `  • ${m}: ${c} 次\n`);
    report += '\n';
  }
  
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
    report += '【常见问题】\n';
    Object.entries(errorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([e, c]) => report += `  • ${e}: ${c} 次\n`);
    report += '\n';
  }
  
  report += '═══════════════════════════════════════\n';
  
  return report;
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  console.log('═══════════════════════════════════════');
  console.log('OpenCode Session Auto-Importer');
  console.log('═══════════════════════════════════════\n');
  
  if (args.includes('--all')) {
    importAll(30);
  } else if (args.includes('--today')) {
    importToday();
  } else if (args.includes('--stats')) {
    const sessions = getSessionList();
    const allInsights = [];
    
    for (const s of sessions.slice(0, 20)) {
      const data = exportSession(s.id);
      if (data) {
        allInsights.push(extractInsights(data));
      }
    }
    
    console.log(generateReport(allInsights));
  } else {
    importLatest();
  }
  
  console.log('\n✅ 导入完成！');
  console.log('运行 node core/bootstrap.js 查看报告');
}

module.exports = {
  getSessionList,
  exportSession,
  importSession,
  importLatest,
  importToday,
  importAll,
  generateReport
};
