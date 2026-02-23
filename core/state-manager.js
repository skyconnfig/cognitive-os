/**
 * State Manager - 认知状态管理器
 * 
 * 核心职责：
 * - 管理当前认知状态
 * - 追踪状态历史
 * - 提供状态查询接口
 * - 触发状态变化事件
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'memory', 'state.json');
const STATE_HISTORY_FILE = path.join(__dirname, 'memory', 'state-history.json');

// 默认状态
const DEFAULT_STATE = {
  focus_mode: 'neutral',        // deep | scattered | neutral
  expansion_lock: false,        // 是否锁定扩展
  active_constraint: null,     // 当前活跃约束
  intervention_level: 1,        // 1-3 干预等级
  current_goal: null,          // 当前唯一目标
  streak_days: 0,              // 连续专注天数
  last_update: null,
  created_at: null
};

/**
 * 加载当前状态
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[StateManager] 加载状态失败:', e.message);
  }
  return { ...DEFAULT_STATE };
}

/**
 * 保存当前状态
 */
function saveState(state) {
  try {
    const memoryDir = path.join(__dirname, 'memory');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    state.last_update = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[StateManager] 保存状态失败:', e.message);
    return false;
  }
}

/**
 * 加载状态历史
 */
function loadHistory() {
  try {
    if (fs.existsSync(STATE_HISTORY_FILE)) {
      const data = fs.readFileSync(STATE_HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[StateManager] 加载历史失败:', e.message);
  }
  return [];
}

/**
 * 保存状态到历史
 */
function saveToHistory(state) {
  try {
    const history = loadHistory();
    history.push({
      timestamp: new Date().toISOString(),
      state: { ...state }
    });
    // 只保留最近 30 天的历史
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filtered = history.filter(h => new Date(h.timestamp) > thirtyDaysAgo);
    fs.writeFileSync(STATE_HISTORY_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[StateManager] 保存历史失败:', e.message);
    return false;
  }
}

/**
 * 更新状态
 */
function updateState(updates) {
  const state = loadState();
  const oldState = { ...state };
  
  Object.assign(state, updates);
  
  if (!state.created_at) {
    state.created_at = new Date().toISOString();
  }
  
  // 检查状态变化，触发干预
  if (state.focus_mode !== oldState.focus_mode) {
    console.log(`[StateManager] 专注模式变化: ${oldState.focus_mode} -> ${state.focus_mode}`);
  }
  
  if (state.intervention_level !== oldState.intervention_level) {
    console.log(`[StateManager] 干预等级变化: ${oldState.intervention_level} -> ${state.intervention_level}`);
  }
  
  saveState(state);
  saveToHistory(state);
  
  return state;
}

/**
 * 获取当前状态
 */
function getState() {
  return loadState();
}

/**
 * 检查是否可以扩展（新增项目）
 */
function canExpand() {
  const state = loadState();
  
  if (state.expansion_lock) {
    return {
      allowed: false,
      reason: state.active_constraint,
      intervention_level: state.intervention_level
    };
  }
  
  if (state.intervention_level >= 3) {
    return {
      allowed: false,
      reason: '高干预等级：强制专注',
      intervention_level: state.intervention_level
    };
  }
  
  return {
    allowed: true,
    reason: null,
    intervention_level: state.intervention_level
  };
}

/**
 * 设置专注模式
 */
function setFocusMode(mode) {
  if (!['deep', 'scattered', 'neutral'].includes(mode)) {
    throw new Error(`无效的专注模式: ${mode}`);
  }
  return updateState({ focus_mode: mode });
}

/**
 * 设置干预等级
 */
function setInterventionLevel(level) {
  if (level < 1 || level > 3) {
    throw new Error('干预等级必须在 1-3 之间');
  }
  return updateState({ intervention_level: level });
}

/**
 * 锁定扩展（禁止新增）
 */
function lockExpansion(constraint) {
  return updateState({
    expansion_lock: true,
    active_constraint: constraint
  });
}

/**
 * 解锁扩展
 */
function unlockExpansion() {
  return updateState({
    expansion_lock: false,
    active_constraint: null
  });
}

/**
 * 设置当前目标
 */
function setCurrentGoal(goal) {
  return updateState({ current_goal: goal });
}

/**
 * 获取最近 N 天的状态历史
 */
function getRecentHistory(days = 7) {
  const history = loadHistory();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return history.filter(h => new Date(h.timestamp) > cutoff);
}

/**
 * 重置状态（危险操作）
 */
function resetState() {
  const freshState = { ...DEFAULT_STATE };
  freshState.created_at = new Date().toISOString();
  saveState(freshState);
  return freshState;
}

module.exports = {
  loadState,
  getState,
  updateState,
  setFocusMode,
  setInterventionLevel,
  lockExpansion,
  unlockExpansion,
  setCurrentGoal,
  canExpand,
  getRecentHistory,
  resetState,
  DEFAULT_STATE
};
