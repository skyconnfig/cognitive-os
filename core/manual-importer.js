/**
 * Manual Session Importer
 * 
 * 手动导入 OpenCode session 数据
 * 
 * 使用方式：
 *   node manual-importer.js
 * 
 * 然后粘贴 session 内容
 */

const reflectionEngine = require('./reflection-engine');
const stateManager = require('./state-manager');

/**
 * 从文本中提取关键信息
 */
function extractFromText(text) {
  const insights = {
    topics: [],
    errors: [],
    decisions: [],
    tools: [],
    files: [],
    content: text
  };
  
  const lower = text.toLowerCase();
  
  // 错误关键词
  const errorPatterns = [
    'error', 'failed', 'bug', '问题', '错误', '修复', 'fix',
    'no payment', 'payment method', '账单'
  ];
  for (const p of errorPatterns) {
    if (lower.includes(p)) {
      insights.errors.push(p);
    }
  }
  
  // 决策关键词
  const decisionPatterns = [
    '决定', '选择', '用', '采用', '决定用', 'choose', 'decide', 'use', 'build', 'create'
  ];
  for (const p of decisionPatterns) {
    if (lower.includes(p)) {
      insights.decisions.push(p);
    }
  }
  
  // 工具关键词
  const toolPatterns = [
    'read', 'write', 'edit', 'grep', 'glob', 'bash', 'task', 'git', 'commit',
    'node', 'javascript', 'python', 'write', 'edit', 'create'
  ];
  for (const p of toolPatterns) {
    if (lower.includes(p)) {
      insights.tools.push(p);
    }
  }
  
  // 文件扩展名
  const extMatches = text.match(/\.([a-z]+)/g) || [];
  insights.files = [...new Set(extMatches.map(e => e.substring(1)))];
  
  // 提取主要话题（第一行或第一句话）
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length > 0) {
    insights.topics.push(lines[0].substring(0, 100));
  }
  
  return insights;
}

/**
 * 导入数据
 */
function importData(text) {
  console.log('\n正在分析...\n');
  
  const insights = extractFromText(text);
  
  console.log(`📊 分析结果:`);
  console.log(`  话题: ${insights.topics.length}`);
  console.log(`  错误: ${[...new Set(insights.errors)].join(', ') || '无'}`);
  console.log(`  决策: ${[...new Set(insights.decisions)].join(', ') || '无'}`);
  console.log(`  工具: ${[...new Set(insights.tools)].slice(0, 5).join(', ') || '无'}`);
  console.log(`  文件类型: ${insights.files.slice(0, 5).join(', ') || '无'}`);
  
  // 记录话题
  if (insights.topics.length > 0) {
    reflectionEngine.setMainTopic(insights.topics[0]);
  }
  
  // 记录错误
  const uniqueErrors = [...new Set(insights.errors)];
  for (const error of uniqueErrors.slice(0, 3)) {
    reflectionEngine.addMistake(error, '使用问题');
  }
  
  // 记录决策
  const uniqueDecisions = [...new Set(insights.decisions)];
  for (const decision of uniqueDecisions.slice(0, 3)) {
    reflectionEngine.addDecision(decision, '从 session 提取');
  }
  
  // 记录工具偏好
  const uniqueTools = [...new Set(insights.tools)];
  if (uniqueTools.length > 0) {
    reflectionEngine.addInsight(`常用工具: ${uniqueTools.slice(0, 5).join(', ')}`);
  }
  
  // 记录文件类型偏好
  if (insights.files.length > 0) {
    reflectionEngine.addInsight(`常用文件类型: ${insights.files.slice(0, 5).join(', ')}`);
  }
  
  // 估算精力状态
  if (text.length > 5000) {
    reflectionEngine.setEnergyState('high');
  } else if (text.length > 1000) {
    reflectionEngine.setEnergyState('neutral');
  } else {
    reflectionEngine.setEnergyState('low');
  }
  
  console.log('\n✅ 已导入到 Cognitive-OS');
  console.log('\n运行 node core/bootstrap.js 查看报告');
}

// 模拟导入当前 session
function importCurrentSession() {
  const currentSessionData = `
用户问题: 帮我解决 No payment method 问题
用户想要: 使用 zen 的免费模型 MiniMax M2.5 Free
用户运行命令: /start-work cognitive-os-v1
错误信息: No payment method. Add a payment method here: https://opencode.ai/workspace/wrk_01KEG128K8WPE398657CHMYV41/billing

解决方案:
1. 在当前会话直接开始工作
2. 创建了升级版的认知系统
3. 添加了干预引擎和状态管理器
4. 系统现在包含 6 个核心模块

创建的文件:
- state-manager.js
- intervention-engine.js
- reflection-engine.js
- analysis-engine.js
- bootstrap.js
- git-sync.js

系统功能:
- 状态管理
- 干预引擎（等级 1-3）
- 反思引擎
- 分析引擎
- Git 同步

后续:
- 创建了 README.md
- 推送到 GitHub
- 用户询问如何让 OpenCode 自动记录
  `;
  
  importData(currentSessionData);
}

// 直接运行
importCurrentSession();
