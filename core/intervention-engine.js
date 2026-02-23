/**
 * Intervention Engine - 干预引擎
 * 
 * 核心职责：
 * - 基于分析结果触发干预
 * - 定义干预等级 (1-3)
 * - 执行行为约束
 * - 强制完成旧任务
 */

const fs = require('fs');
const path = require('path');
const stateManager = require('./state-manager');

const ERRORS_FILE = path.join(__dirname, 'memory', 'errors.json');
const UNRESOLVED_FILE = path.join(__dirname, 'memory', 'unresolved.json');
const INTERVENTIONS_LOG = path.join(__dirname, 'memory', 'interventions.json');

// 干预规则定义
const INTERVENTION_RULES = {
  // 连续 N 天新增项目 -> 锁定扩展
  expansion_limit: {
    threshold: 7,
    action: 'lock_expansion',
    level: 2,
    message: '连续 7 天新增项目，已锁定扩展'
  },
  
  // 同一错误出现 N 次 -> 强制写 counter_strategy
  error_recurrence: {
    threshold: 3,
    action: 'force_counter_strategy',
    level: 2,
    message: '同一错误出现 3 次，必须编写反制策略'
  },
  
  // 未完成事项 > N -> 禁止新增
  unfinished_limit: {
    threshold: 5,
    action: 'lock_expansion',
    level: 3,
    message: '未完成事项超过 5 个，禁止新增'
  },
  
  // 干预等级 3 持续 N 天 -> 降级
  high_level_duration: {
    threshold: 3,
    action: 'degrade_level',
    level: 1,
    message: '高干预等级持续 3 天，尝试降级'
  },
  
  // 连续 N 天 scattered -> 警告
  scattered_streak: {
    threshold: 3,
    action: 'warn_scattered',
    level: 1,
    message: '连续 3 天精力分散，需要调整'
  }
};

/**
 * 加载错误数据
 */
function loadErrors() {
  try {
    if (fs.existsSync(ERRORS_FILE)) {
      return JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Intervention] 加载错误失败:', e.message);
  }
  return [];
}

/**
 * 加载未完成事项
 */
function loadUnresolved() {
  try {
    if (fs.existsSync(UNRESOLVED_FILE)) {
      return JSON.parse(fs.readFileSync(UNRESOLVED_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Intervention] 加载未完成失败:', e.message);
  }
  return [];
}

/**
 * 记录干预
 */
function logIntervention(intervention) {
  try {
    let log = [];
    if (fs.existsSync(INTERVENTIONS_LOG)) {
      log = JSON.parse(fs.readFileSync(INTERVENTIONS_LOG, 'utf-8'));
    }
    log.push({
      timestamp: new Date().toISOString(),
      ...intervention
    });
    fs.writeFileSync(INTERVENTIONS_LOG, JSON.stringify(log, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Intervention] 记录干预失败:', e.message);
  }
}

/**
 * 检查是否触发干预
 * @param {Object} analysisResults - 分析引擎的结果
 * @returns {Object} 干预结果
 */
function checkIntervention(analysisResults) {
  const state = stateManager.getState();
  const errors = loadErrors();
  const unresolved = loadUnresolved();
  
  const interventions = [];
  
  // 检查连续新增项目
  if (analysisResults.new_projects_streak >= INTERVENTION_RULES.expansion_limit.threshold) {
    interventions.push({
      type: 'expansion_limit',
      level: INTERVENTION_RULES.expansion_limit.level,
      message: INTERVENTION_RULES.expansion_limit.message,
      action: 'lock_expansion',
      data: { streak: analysisResults.new_projects_streak }
    });
  }
  
  // 检查未完成事项
  if (unresolved.length >= INTERVENTION_RULES.unfinished_limit.threshold) {
    interventions.push({
      type: 'unfinished_limit',
      level: INTERVENTION_RULES.unfinished_limit.level,
      message: INTERVENTION_RULES.unfinished_limit.message,
      action: 'lock_expansion',
      data: { count: unresolved.length }
    });
  }
  
  // 检查重复错误（排除已解决的）
  const repeatedErrors = errors.filter(e => e.occurrences >= INTERVENTION_RULES.error_recurrence.threshold && e.status !== 'resolved');
  if (repeatedErrors.length > 0) {
    repeatedErrors.forEach(err => {
      interventions.push({
        type: 'error_recurrence',
        level: INTERVENTION_RULES.error_recurrence.level,
        message: `错误 "${err.type}" 出现 ${err.occurrences} 次 - ${INTERVENTION_RULES.error_recurrence.message}`,
        action: 'force_counter_strategy',
        data: { error: err }
      });
    });
  }
  
  // 检查精力分散
  if (analysisResults.scattered_streak >= INTERVENTION_RULES.scattered_streak.threshold) {
    interventions.push({
      type: 'scattered_streak',
      level: INTERVENTION_RULES.scattered_streak.level,
      message: INTERVENTION_RULES.scattered_streak.message,
      action: 'warn_scattered',
      data: { streak: analysisResults.scattered_streak }
    });
  }
  
  // 检查高干预等级持续时间
  if (state.intervention_level >= 3 && analysisResults.high_level_days >= INTERVENTION_RULES.high_level_duration.threshold) {
    interventions.push({
      type: 'high_level_duration',
      level: INTERVENTION_RULES.high_level_duration.level,
      message: INTERVENTION_RULES.high_level_duration.message,
      action: 'degrade_level',
      data: { days: analysisResults.high_level_days }
    });
  }
  
  return interventions;
}

/**
 * 执行干预
 * @param {Array} interventions - 干预列表
 * @returns {Object} 执行结果
 */
function executeIntervention(interventions) {
  if (!interventions || interventions.length === 0) {
    return { executed: [], skipped: [] };
  }
  
  const executed = [];
  const skipped = [];
  
  for (const intervention of interventions) {
    try {
      switch (intervention.action) {
        case 'lock_expansion':
          stateManager.lockExpansion(intervention.message);
          stateManager.setInterventionLevel(intervention.level);
          executed.push(intervention);
          console.log(`[Intervention] 执行锁定扩展: ${intervention.message}`);
          break;
          
        case 'force_counter_strategy':
          // 需要用户编写反制策略
          executed.push(intervention);
          console.log(`[Intervention] 要求编写反制策略: ${intervention.message}`);
          break;
          
        case 'degrade_level':
          if (stateManager.getState().intervention_level > 1) {
            stateManager.setInterventionLevel(stateManager.getState().intervention_level - 1);
            executed.push(intervention);
            console.log(`[Intervention] 降级干预等级: ${intervention.message}`);
          } else {
            skipped.push({ ...intervention, reason: '已是最低等级' });
          }
          break;
          
        case 'warn_scattered':
          executed.push(intervention);
          console.log(`[Intervention] 发出警告: ${intervention.message}`);
          break;
          
        default:
          skipped.push({ ...intervention, reason: '未知动作' });
      }
      
      // 记录干预
      logIntervention(intervention);
      
    } catch (e) {
      console.error(`[Intervention] 执行干预失败: ${e.message}`);
      skipped.push({ ...intervention, reason: e.message });
    }
  }
  
  return { executed, skipped };
}

/**
 * 生成干预报告
 * @param {Array} interventions - 干预列表
 * @returns {String} 报告文本
 */
function generateInterventionReport(interventions) {
  if (!interventions || interventions.length === 0) {
    return '✅ 无需干预 - 当前状态良好';
  }
  
  let report = '\n';
  report += '═══════════════════════════════════════\n';
  report += '⚠️  干预报告\n';
  report += '═══════════════════════════════════════\n\n';
  
  // 按等级分组
  const byLevel = { 1: [], 2: [], 3: [] };
  interventions.forEach(i => byLevel[i.level].push(i));
  
  // 等级 3（重度）
  if (byLevel[3].length > 0) {
    report += '🔴 【等级 3 - 重度干预】\n';
    byLevel[3].forEach(i => {
      report += `   • ${i.message}\n`;
    });
    report += '\n';
  }
  
  // 等级 2（中度）
  if (byLevel[2].length > 0) {
    report += '🟠 【等级 2 - 中度干预】\n';
    byLevel[2].forEach(i => {
      report += `   • ${i.message}\n`;
    });
    report += '\n';
  }
  
  // 等级 1（轻度）
  if (byLevel[1].length > 0) {
    report += '🟡 【等级 1 - 轻度提醒】\n';
    byLevel[1].forEach(i => {
      report += `   • ${i.message}\n`;
    });
    report += '\n';
  }
  
  report += '═══════════════════════════════════════\n';
  
  return report;
}

/**
 * 检查是否可以解锁扩展
 */
function checkUnlockCondition() {
  const state = stateManager.getState();
  const unresolved = loadUnresolved();
  
  // 如果未完成事项减少，可以解锁
  if (unresolved.length < 3 && state.expansion_lock) {
    return {
      canUnlock: true,
      reason: '未完成事项已减少到 3 个以下'
    };
  }
  
  return {
    canUnlock: false,
    reason: state.active_constraint
  };
}

/**
 * 获取干预历史
 */
function getInterventionHistory(days = 7) {
  try {
    if (fs.existsSync(INTERVENTIONS_LOG)) {
      const log = JSON.parse(fs.readFileSync(INTERVENTIONS_LOG, 'utf-8'));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return log.filter(l => new Date(l.timestamp) > cutoff);
    }
  } catch (e) {
    console.error('[Intervention] 获取历史失败:', e.message);
  }
  return [];
}

module.exports = {
  checkIntervention,
  executeIntervention,
  generateInterventionReport,
  checkUnlockCondition,
  getInterventionHistory,
  INTERVENTION_RULES
};
