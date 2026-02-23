/**
 * Bootstrap - 认知进化系统启动入口
 * 
 * 核心职责：
 * - 系统初始化
 * - 启动时强干预分析
 * - 生成启动报告
 * - 协调各模块
 */

const path = require('path');
const fs = require('fs');

const stateManager = require('./state-manager');
const analysisEngine = require('./analysis-engine');
const interventionEngine = require('./intervention-engine');
const reflectionEngine = require('./reflection-engine');

const REPORTS_DIR = path.join(__dirname, 'reports');
const CONFIG_FILE = path.join(__dirname, '.config.json');

/**
 * 确保必要目录存在
 */
function ensureDirectories() {
  const dirs = [
    path.join(__dirname, 'memory'),
    path.join(__dirname, 'memory', 'timeline'),
    REPORTS_DIR
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * 加载配置
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Bootstrap] 加载配置失败:', e.message);
  }
  
  // 默认配置
  return {
    analysis_days: 7,
    auto_git_commit: true,
    intervention_enabled: true,
    report_format: 'text'
  };
}

/**
 * 检查系统状态
 */
function checkSystemStatus() {
  const state = stateManager.getState();
  const config = loadConfig();
  
  return {
    state,
    config,
    canExpand: stateManager.canExpand()
  };
}

/**
 * 生成启动报告
 */
function generateStartupReport() {
  ensureDirectories();
  
  const analysisResult = analysisEngine.generateAnalysisReport();
  const interventionData = analysisEngine.getInterventionData();
  const status = checkSystemStatus();
  
  // 检查是否需要干预
  const interventions = interventionEngine.checkIntervention(interventionData);
  const executionResult = interventionEngine.executeIntervention(interventions);
  
  // 生成报告
  let report = '';
  report += '═══════════════════════════════════════════════════════════\n';
  report += '🧠 Cognitive-OS V1 启动报告\n';
  report += `🕐 ${new Date().toLocaleString('zh-CN')}\n`;
  report += '═══════════════════════════════════════════════════════════\n\n';
  
  // 当前状态
  report += '【当前状态】\n';
  report += `  • 干预等级: ${status.state.intervention_level}\n`;
  report += `  • 专注模式: ${status.state.focus_mode}\n`;
  report += `  • 扩展锁定: ${status.state.expansion_lock ? '是 ⚠️' : '否 ✅'}\n`;
  if (status.state.active_constraint) {
    report += `  • 活跃约束: ${status.state.active_constraint}\n`;
  }
  if (status.state.current_goal) {
    report += `  • 当前目标: ${status.state.current_goal}\n`;
  }
  report += '\n';
  
  // 扩展能力
  const expandCheck = status.canExpand;
  if (!expandCheck.allowed) {
    report += '🔒 【扩展限制】\n';
    report += `  • 原因: ${expandCheck.reason}\n`;
    report += `  • 等级: ${expandCheck.intervention_level}\n\n`;
  } else {
    report += '✅ 【扩展能力】正常\n\n';
  }
  
  // 分析报告
  report += analysisResult.text;
  
  // 干预报告
  report += '\n';
  report += interventionEngine.generateInterventionReport(interventions);
  
  // 进化建议
  report += '\n';
  report += generateEvolutionSuggestions(analysisResult, status);
  
  // 保存报告
  const today = new Date().toISOString().split('T')[0];
  const reportFile = path.join(REPORTS_DIR, `startup-report-${today}.txt`);
  fs.writeFileSync(reportFile, report, 'utf-8');
  console.log(`[Bootstrap] 报告已保存: ${reportFile}`);
  
  return {
    report,
    interventions,
    executionResult,
    status,
    analysis: analysisResult
  };
}

/**
 * 生成进化建议
 */
function generateEvolutionSuggestions(analysisResult, status) {
  let suggestions = '';
  suggestions += '═══════════════════════════════════════\n';
  suggestions += '💡 进化建议\n';
  suggestions += '═══════════════════════════════════════\n\n';
  
  const analysis = analysisResult.analysis;
  let hasSuggestions = false;
  
  // 建议 1: 精力管理
  if (analysis.energy_distribution.low > analysis.energy_distribution.high) {
    suggestions += '1. ⚠️ 精力管理\n';
    suggestions += '   近期精力偏低天数较多，建议：\n';
    suggestions += '   • 减少每日任务数量\n';
    suggestions += '   • 增加休息时间\n';
    suggestions += '   • 避免重要决策在低精力时段\n\n';
    hasSuggestions = true;
  }
  
  // 建议 2: 完成旧任务
  if (analysis.unfinished_count >= 3) {
    suggestions += '2. ⚠️ 清理未完成事项\n';
    suggestions += `   当前有 ${analysis.unfinished_count} 个未完成事项。\n`;
    suggestions += '   建议优先完成旧任务，再考虑新增。\n\n';
    hasSuggestions = true;
  }
  
  // 建议 3: 错误改进
  if (analysis.repeated_errors.length > 0) {
    suggestions += '3. ⚠️ 错误模式识别\n';
    suggestions += '   检测到重复错误，建议：\n';
    suggestions += '   • 为每个重复错误编写 counter_strategy\n';
    suggestions += '   • 识别触发情境\n';
    suggestions += '   • 建立预防机制\n\n';
    hasSuggestions = true;
  }
  
  // 建议 4: 高干预等级
  if (status.state.intervention_level >= 2) {
    suggestions += '4. ℹ️ 高干预模式\n';
    suggestions += `   当前干预等级: ${status.state.intervention_level}\n`;
    suggestions += '   系统正在帮助你保持专注。\n';
    suggestions += '   建议：\n';
    suggestions += '   • 专注于当前目标\n';
    suggestions += '   • 避免分散注意力\n';
    suggestions += '   • 完成现有任务后再扩张\n\n';
    hasSuggestions = true;
  }
  
  if (!hasSuggestions) {
    suggestions += '   状态良好，继续保持！\n\n';
  }
  
  suggestions += '═══════════════════════════════════════\n';
  
  return suggestions;
}

/**
 * 交互式启动（用于手动触发）
 */
function interactiveBootstrap() {
  console.log('\n🧠 Cognitive-OS V1 启动中...\n');
  
  const result = generateStartupReport();
  
  console.log(result.report);
  
  return result;
}

/**
 * 轻量级检查（不生成报告）
 */
function quickCheck() {
  const status = checkSystemStatus();
  const canExpand = status.canExpand;
  
  console.log('\n🧠 Cognitive-OS 状态检查');
  console.log(`  干预等级: ${status.state.intervention_level}`);
  console.log(`  专注模式: ${status.state.focus_mode}`);
  console.log(`  扩展锁定: ${status.state.expansion_lock ? '是 ⚠️' : '否 ✅'}`);
  
  if (!canExpand.allowed) {
    console.log(`  限制原因: ${canExpand.reason}`);
    console.log('\n  💡 提示: 完成旧任务后可解锁扩展');
  }
  
  return status;
}

/**
 * 设置今日目标
 */
function setTodayGoal(goal) {
  stateManager.setCurrentGoal(goal);
  console.log(`✅ 今日目标已设置: ${goal}`);
}

/**
 * 记录本次会话
 */
function recordSession(sessionData) {
  if (sessionData.topic) {
    reflectionEngine.setMainTopic(sessionData.topic);
  }
  
  if (sessionData.energy) {
    reflectionEngine.setEnergyState(sessionData.energy);
  }
  
  if (sessionData.decisions) {
    for (const d of sessionData.decisions) {
      reflectionEngine.addDecision(d.decision, d.context || '');
    }
  }
  
  if (sessionData.mistakes) {
    for (const m of sessionData.mistakes) {
      reflectionEngine.addMistake(m.mistake, m.type || 'general');
    }
  }
  
  if (sessionData.unfinished) {
    for (const u of sessionData.unfinished) {
      reflectionEngine.addUnfinished(u);
    }
  }
  
  if (sessionData.insights) {
    for (const i of sessionData.insights) {
      reflectionEngine.addInsight(i);
    }
  }
  
  console.log('✅ 会话记录已保存');
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--check' || args[0] === '-c') {
    quickCheck();
  } else if (args[0] === '--goal' && args[1]) {
    setTodayGoal(args.slice(1).join(' '));
  } else {
    interactiveBootstrap();
  }
}

module.exports = {
  generateStartupReport,
  interactiveBootstrap,
  quickCheck,
  setTodayGoal,
  recordSession,
  checkSystemStatus,
  ensureDirectories,
  loadConfig
};
