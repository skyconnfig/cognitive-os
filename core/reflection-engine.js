/**
 * Reflection Engine - 反思引擎
 * 
 * 核心职责：
 * - 引导用户进行会话反思
 * - 记录每日认知数据
 * - 提取关键决策和错误
 */

const fs = require('fs');
const path = require('path');

const TIMELINE_DIR = path.join(__dirname, 'memory', 'timeline');

/**
 * 确保 timeline 目录存在
 */
function ensureTimelineDir() {
  if (!fs.existsSync(TIMELINE_DIR)) {
    fs.mkdirSync(TIMELINE_DIR, { recursive: true });
  }
}

/**
 * 获取今天的 timeline 文件路径
 */
function getTodayFile() {
  const today = new Date().toISOString().split('T')[0];
  return path.join(TIMELINE_DIR, `${today}.json`);
}

/**
 * 加载今天的记录
 */
function loadToday() {
  const file = getTodayFile();
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error('[Reflection] 加载今日记录失败:', e.message);
  }
  return null;
}

/**
 * 保存今日记录
 */
function saveToday(data) {
  ensureTimelineDir();
  const file = getTodayFile();
  data.date = new Date().toISOString().split('T')[0];
  data.last_updated = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  return file;
}

/**
 * 创建新的每日记录
 */
function createDailyRecord() {
  return {
    date: new Date().toISOString().split('T')[0],
    main_topic: null,
    decisions: [],
    mistakes: [],
    error_types: [],
    energy_state: 'neutral',  // high | neutral | low
    unfinished_threads: [],
    insights: [],
    self_bias_detected: [],
    created_at: new Date().toISOString()
  };
}

/**
 * 记录主话题
 */
function setMainTopic(topic) {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.main_topic = topic;
  saveToday(record);
  return record;
}

/**
 * 添加决策
 */
function addDecision(decision, context = '') {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.decisions.push({
    decision,
    context,
    timestamp: new Date().toISOString()
  });
  saveToday(record);
  return record;
}

/**
 * 添加错误/失误
 */
function addMistake(mistake, type = 'general') {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.mistakes.push({
    mistake,
    type,
    timestamp: new Date().toISOString()
  });
  
  // 同时更新错误数据库
  updateErrorDatabase(mistake, type);
  
  saveToday(record);
  return record;
}

/**
 * 更新错误数据库
 */
function updateErrorDatabase(mistake, type) {
  const errorsFile = path.join(__dirname, 'memory', 'errors.json');
  let errors = [];
  
  try {
    if (fs.existsSync(errorsFile)) {
      errors = JSON.parse(fs.readFileSync(errorsFile, 'utf-8'));
    }
  } catch (e) {
    console.error('[Reflection] 加载错误库失败:', e.message);
  }
  
  // 查找现有错误（按错误内容查找，而非分类）
  const existing = errors.find(e => e.type === mistake);
  
  if (existing) {
    existing.occurrences += 1;
    existing.last_seen = new Date().toISOString().split('T')[0];
  } else {
    errors.push({
      type,
      category: categorizeError(type),
      first_seen: new Date().toISOString().split('T')[0],
      last_seen: new Date().toISOString().split('T')[0],
      occurrences: 1,
      trigger_context: [],
      behavioral_pattern: '',
      counter_strategy: '',
      recurrence_interval_days: 0,
      severity_level: 1,
      status: 'active'
    });
  }
  
  fs.writeFileSync(errorsFile, JSON.stringify(errors, null, 2), 'utf-8');
}

/**
 * 分类错误
 */
function categorizeError(type) {
  const categories = {
    '过度架构': '认知偏差',
    '拖延': '行为模式',
    '过度优化': '认知偏差',
    '完美主义': '认知偏差',
    '冲动实现': '行为模式',
    '缺乏沟通': '协作问题',
    '技术选型错误': '决策失误',
    'Scope Creep': '行为模式'
  };
  return categories[type] || '其他';
}

/**
 * 设置精力状态
 */
function setEnergyState(state) {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  if (!['high', 'neutral', 'low'].includes(state)) {
    throw new Error('精力状态必须是 high, neutral 或 low');
  }
  record.energy_state = state;
  saveToday(record);
  return record;
}

/**
 * 添加未完成事项
 */
function addUnfinished(thread) {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.unfinished_threads.push({
    thread,
    timestamp: new Date().toISOString()
  });
  
  // 同时更新未完成数据库
  updateUnresolvedDatabase(thread);
  
  saveToday(record);
  return record;
}

/**
 * 更新未完成数据库
 */
function updateUnresolvedDatabase(thread) {
  const unresolvedFile = path.join(__dirname, 'memory', 'unresolved.json');
  let unresolved = [];
  
  try {
    if (fs.existsSync(unresolvedFile)) {
      unresolved = JSON.parse(fs.readFileSync(unresolvedFile, 'utf-8'));
    }
  } catch (e) {
    console.error('[Reflection] 加载未完成列表失败:', e.message);
  }
  
  // 检查是否已存在
  const existing = unresolved.find(u => u.topic === thread);
  if (!existing) {
    unresolved.push({
      topic: thread,
      opened: new Date().toISOString().split('T')[0],
      last_touched: new Date().toISOString().split('T')[0],
      status: 'open'
    });
  } else {
    existing.last_touched = new Date().toISOString().split('T')[0];
  }
  
  fs.writeFileSync(unresolvedFile, JSON.stringify(unresolved, null, 2), 'utf-8');
}

/**
 * 添加洞见
 */
function addInsight(insight) {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.insights.push({
    insight,
    timestamp: new Date().toISOString()
  });
  saveToday(record);
  return record;
}

/**
 * 记录认知偏差
 */
function addBiasDetected(bias, description) {
  let record = loadToday();
  if (!record) {
    record = createDailyRecord();
  }
  record.self_bias_detected.push({
    bias,
    description,
    timestamp: new Date().toISOString()
  });
  saveToday(record);
  return record;
}

/**
 * 标记未完成事项为完成
 */
function resolveUnresolved(topic) {
  const unresolvedFile = path.join(__dirname, 'memory', 'unresolved.json');
  let unresolved = [];
  
  try {
    if (fs.existsSync(unresolvedFile)) {
      unresolved = JSON.parse(fs.readFileSync(unresolvedFile, 'utf-8'));
    }
  } catch (e) {
    console.error('[Reflection] 加载未完成列表失败:', e.message);
  }
  
  const item = unresolved.find(u => u.topic === topic);
  if (item) {
    item.status = 'resolved';
    item.resolved_at = new Date().toISOString().split('T')[0];
    fs.writeFileSync(unresolvedFile, JSON.stringify(unresolved, null, 2), 'utf-8');
  }
  
  return unresolved;
}

/**
 * 获取最近的 timeline
 */
function getRecentTimelines(days = 7) {
  ensureTimelineDir();
  const files = fs.readdirSync(TIMELINE_DIR);
  const timelines = [];
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(TIMELINE_DIR, file);
    const stat = fs.statSync(filePath);
    
    if (stat.mtime > cutoff) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        timelines.push(data);
      } catch (e) {
        console.error(`[Reflection] 加载 ${file} 失败:`, e.message);
      }
    }
  }
  
  return timelines.sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  loadToday,
  saveToday,
  createDailyRecord,
  setMainTopic,
  addDecision,
  addMistake,
  setEnergyState,
  addUnfinished,
  addInsight,
  addBiasDetected,
  resolveUnresolved,
  getRecentTimelines
};
