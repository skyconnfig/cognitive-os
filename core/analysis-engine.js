/**
 * Analysis Engine - 分析引擎
 * 
 * 核心职责：
 * - 分析最近 7 天认知数据
 * - 识别重复模式
 * - 计算各种指标
 * - 为干预引擎提供数据
 */

const fs = require('fs');
const path = require('path');
const reflectionEngine = require('./reflection-engine');

const ERRORS_FILE = path.join(__dirname, 'memory', 'errors.json');
const UNRESOLVED_FILE = path.join(__dirname, 'memory', 'unresolved.json');
const PATTERNS_FILE = path.join(__dirname, 'memory', 'patterns.json');

/**
 * 加载错误数据
 */
function loadErrors() {
  try {
    if (fs.existsSync(ERRORS_FILE)) {
      return JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Analysis] 加载错误失败:', e.message);
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
    console.error('[Analysis] 加载未完成失败:', e.message);
  }
  return [];
}

/**
 * 加载模式数据
 */
function loadPatterns() {
  try {
    if (fs.existsSync(PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Analysis] 加载模式失败:', e.message);
  }
  return [];
}

/**
 * 保存模式数据
 */
function savePatterns(patterns) {
  try {
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Analysis] 保存模式失败:', e.message);
    return false;
  }
}

/**
 * 分析最近 7 天数据
 */
function analyzeRecentData(days = 7) {
  const timelines = reflectionEngine.getRecentTimelines(days);
  const errors = loadErrors();
  const unresolved = loadUnresolved();
  
  const result = {
    days_analyzed: timelines.length,
    total_decisions: 0,
    total_mistakes: 0,
    total_insights: 0,
    energy_distribution: { high: 0, neutral: 0, low: 0 },
    high_frequency_topics: [],
    repeated_errors: [],
    repeated_mistakes: [],
    new_projects_streak: 0,
    scattered_streak: 0,
    high_level_days: 0,
    unfinished_count: unresolved.filter(u => u.status === 'open').length
  };
  
  // 统计 timeline 数据
  for (const timeline of timelines) {
    result.total_decisions += timeline.decisions?.length || 0;
    result.total_mistakes += timeline.mistakes?.length || 0;
    result.total_insights += timeline.insights?.length || 0;
    
    if (timeline.energy_state) {
      result.energy_distribution[timeline.energy_state] = 
        (result.energy_distribution[timeline.energy_state] || 0) + 1;
    }
    
    // 追踪精力分散连续天数
    if (timeline.energy_state === 'low') {
      result.scattered_streak += 1;
    } else {
      result.scattered_streak = 0;
    }
  }
  
  // 统计高频主题
  const topicCount = {};
  for (const timeline of timelines) {
    if (timeline.main_topic) {
      topicCount[timeline.main_topic] = (topicCount[timeline.main_topic] || 0) + 1;
    }
  }
  result.high_frequency_topics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));
  
  // 找出重复错误（排除已解决的）
  result.repeated_errors = errors
    .filter(e => e.occurrences >= 2 && e.status !== 'resolved')
    .sort((a, b) => b.occurrences - a.occurrences);
  
  // 统计重复失误类型
  const mistakeTypes = {};
  for (const timeline of timelines) {
    for (const mistake of timeline.mistakes || []) {
      mistakeTypes[mistake.type] = (mistakeTypes[mistake.type] || 0) + 1;
    }
  }
  result.repeated_mistakes = Object.entries(mistakeTypes)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
  
  return result;
}

/**
 * 识别模式
 */
function identifyPatterns() {
  const analysis = analyzeRecentData(7);
  const patterns = loadPatterns();
  const newPatterns = [];
  
  // 模式 1: 高频主题
  if (analysis.high_frequency_topics.length > 0) {
    const topTopic = analysis.high_frequency_topics[0];
    if (topTopic.count >= 4) {
      newPatterns.push({
        type: '高频主题',
        description: `主题 "${topTopic.topic}" 在 7 天内出现 ${topTopic.count} 次`,
        data: topTopic,
        identified_at: new Date().toISOString()
      });
    }
  }
  
  // 模式 2: 精力波动
  const { high, neutral, low } = analysis.energy_distribution;
  if (low > high && low >= 3) {
    newPatterns.push({
      type: '精力波动',
      description: '近期精力状态偏低，需要调整',
      data: analysis.energy_distribution,
      identified_at: new Date().toISOString()
    });
  }
  
  // 模式 3: 重复错误
  if (analysis.repeated_errors.length > 0) {
    for (const error of analysis.repeated_errors) {
      newPatterns.push({
        type: '重复错误',
        description: `错误 "${error.type}" 出现 ${error.occurrences} 次`,
        data: error,
        identified_at: new Date().toISOString()
      });
    }
  }
  
  // 模式 4: 未完成累积
  if (analysis.unfinished_count >= 5) {
    newPatterns.push({
      type: '未完成累积',
      description: `有 ${analysis.unfinished_count} 个未完成事项`,
      data: { count: analysis.unfinished_count },
      identified_at: new Date().toISOString()
    });
  }
  
  // 合并新模式
  const existingTypes = patterns.map(p => p.type + p.description);
  const uniqueNewPatterns = newPatterns.filter(p => 
    !existingTypes.includes(p.type + p.description)
  );
  
  if (uniqueNewPatterns.length > 0) {
    const updatedPatterns = [...patterns, ...uniqueNewPatterns];
    savePatterns(updatedPatterns);
  }
  
  return {
    existing: patterns,
    new: uniqueNewPatterns
  };
}

/**
 * 生成分析报告
 */
function generateAnalysisReport() {
  const analysis = analyzeRecentData(7);
  const patterns = identifyPatterns();
  
  let report = '\n';
  report += '═══════════════════════════════════════\n';
  report += '📊 认知分析报告 (最近 7 天)\n';
  report += '═══════════════════════════════════════\n\n';
  
  // 基本统计
  report += '【基本统计】\n';
  report += `  • 分析天数: ${analysis.days_analyzed}\n`;
  report += `  • 决策数量: ${analysis.total_decisions}\n`;
  report += `  • 失误数量: ${analysis.total_mistakes}\n`;
  report += `  • 洞见数量: ${analysis.total_insights}\n`;
  report += `  • 未完成: ${analysis.unfinished_count}\n\n`;
  
  // 精力分布
  report += '【精力分布】\n';
  const total = analysis.days_analyzed || 1;
  report += `  🟢 高: ${analysis.energy_distribution.high} (${Math.round(analysis.energy_distribution.high / total * 100)}%)\n`;
  report += `  🟡 中: ${analysis.energy_distribution.neutral} (${Math.round(analysis.energy_distribution.neutral / total * 100)}%)\n`;
  report += `  🔴 低: ${analysis.energy_distribution.low} (${Math.round(analysis.energy_distribution.low / total * 100)}%)\n\n`;
  
  // 高频主题
  if (analysis.high_frequency_topics.length > 0) {
    report += '【高频主题】\n';
    for (const topic of analysis.high_frequency_topics) {
      report += `  • ${topic.topic}: ${topic.count} 次\n`;
    }
    report += '\n';
  }
  
  // 重复错误
  if (analysis.repeated_errors.length > 0) {
    report += '【重复错误】\n';
    for (const error of analysis.repeated_errors.slice(0, 3)) {
      report += `  ⚠️ ${error.type} (${error.category}): ${error.occurrences} 次\n`;
    }
    report += '\n';
  }
  
  // 新识别的模式
  if (patterns.new.length > 0) {
    report += '【新识别模式】\n';
    for (const pattern of patterns.new) {
      report += `  • ${pattern.type}: ${pattern.description}\n`;
    }
    report += '\n';
  }
  
  report += '═══════════════════════════════════════\n';
  
  return {
    text: report,
    analysis,
    patterns
  };
}

/**
 * 获取干预所需数据
 */
function getInterventionData() {
  const analysis = analyzeRecentData(7);
  
  return {
    new_projects_streak: analysis.high_frequency_topics[0]?.count || 0,
    scattered_streak: analysis.scattered_streak,
    high_level_days: 0, // 需要从状态历史中计算
    error_count: analysis.repeated_errors.length,
    unfinished_count: analysis.unfinished_count
  };
}

module.exports = {
  analyzeRecentData,
  identifyPatterns,
  generateAnalysisReport,
  getInterventionData
};
