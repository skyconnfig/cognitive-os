/**
 * Counter Strategy Manager
 * 
 * 管理错误反制策略
 * 
 * 使用方式：
 *   node core/counter-strategy.js add "错误类型"  # 添加策略
 *   node core/counter-strategy.js list            # 列出所有策略
 *   node core/counter-strategy.js check         # 检查需要策略的错误
 */

const fs = require('fs');
const path = require('path');

const ERRORS_FILE = path.join(__dirname, 'memory', 'errors.json');
const STRATEGIES_FILE = path.join(__dirname, 'memory', 'counter-strategies.json');

/**
 * 加载错误数据
 */
function loadErrors() {
  try {
    if (fs.existsSync(ERRORS_FILE)) {
      return JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Strategy] 加载错误失败:', e.message);
  }
  return [];
}

/**
 * 加载策略
 */
function loadStrategies() {
  try {
    if (fs.existsSync(STRATEGIES_FILE)) {
      return JSON.parse(fs.readFileSync(STRATEGIES_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Strategy] 加载策略失败:', e.message);
  }
  return [];
}

/**
 * 保存策略
 */
function saveStrategies(strategies) {
  fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(strategies, null, 2), 'utf-8');
}

/**
 * 添加策略
 */
function addStrategy(errorType, strategyData) {
  const strategies = loadStrategies();
  
  const existing = strategies.find(s => s.error === errorType);
  
  if (existing) {
    Object.assign(existing, strategyData);
    existing.updated_at = new Date().toISOString();
  } else {
    strategies.push({
      error: errorType,
      ...strategyData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  
  saveStrategies(strategies);
  console.log(`✅ 已添加/更新策略: ${errorType}`);
}

/**
 * 列出所有策略
 */
function listStrategies() {
  const strategies = loadStrategies();
  const errors = loadErrors();
  
  console.log('\n═══════════════════════════════════════');
  console.log('📋 Counter Strategy 列表');
  console.log('═══════════════════════════════════════\n');
  
  if (strategies.length === 0) {
    console.log('暂无策略');
    return;
  }
  
  for (const s of strategies) {
    console.log(`❌ 错误: ${s.error}`);
    console.log(`   触发情境: ${s.trigger_context || '未设置'}`);
    console.log(`   行为模式: ${s.behavior_pattern || '未设置'}`);
    console.log(`   反制策略:`);
    
    if (s.counter_strategy && Array.isArray(s.counter_strategy)) {
      for (const item of s.counter_strategy) {
        console.log(`     • ${item}`);
      }
    } else {
      console.log(`     ${s.counter_strategy || '未设置'}`);
    }
    
    console.log(`   验证规则: ${s.verification_rule || '未设置'}`);
    console.log('');
  }
  
  const errorsNeedingStrategy = errors.filter(e => 
    e.occurrences >= 2 && !strategies.find(s => s.error === e.type)
  );
  
  if (errorsNeedingStrategy.length > 0) {
    console.log('⚠️ 需要添加策略的错误:');
    for (const e of errorsNeedingStrategy) {
      console.log(`   • ${e.type} (出现 ${e.occurrences} 次)`);
    }
  }
}

/**
 * 检查需要策略的错误
 */
function checkErrors() {
  const strategies = loadStrategies();
  const errors = loadErrors();
  
  console.log('\n═══════════════════════════════════════');
  console.log('🔍 错误检查');
  console.log('═══════════════════════════════════════\n');
  
  const repeatedErrors = errors.filter(e => e.occurrences >= 2);
  
  if (repeatedErrors.length === 0) {
    console.log('✅ 没有重复错误');
    return;
  }
  
  console.log(`发现 ${repeatedErrors.length} 个重复错误:\n`);
  
  for (const e of repeatedErrors) {
    const hasStrategy = strategies.find(s => s.error === e.type);
    const status = hasStrategy ? '✅' : '❌';
    console.log(`${status} ${e.type} (${e.category}) - ${e.occurrences} 次`);
    
    if (!hasStrategy) {
      console.log(`   需要添加 Counter Strategy!`);
    }
  }
  
  return repeatedErrors.filter(e => !strategies.find(s => s.error === e.type));
}

/**
 * 交互式添加策略
 */
function interactiveAdd(errorType) {
  console.log(`\n为 "${errorType}" 添加 Counter Strategy\n`);
  
  const strategy = {
    error: errorType,
    trigger_context: '遇到工具限制 + 环境不熟',
    behavior_pattern: '反复调试工具，延迟核心任务',
    counter_strategy: [
      '工具问题调试时间限制 10 分钟',
      '10 分钟未解决立即切换替代方案',
      '记录未解决问题，但不继续消耗主任务时间'
    ],
    verification_rule: '若 7 天内再次出现，则升级 Level 3',
    level: 2
  };
  
  console.log('将创建以下策略:\n');
  console.log(JSON.stringify(strategy, null, 2));
  console.log('');
  
  addStrategy(errorType, strategy);
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  console.log('═══════════════════════════════════════');
  console.log('Counter Strategy Manager');
  console.log('═══════════════════════════════════════\n');
  
  if (args[0] === 'add' && args[1]) {
    if (args[2]) {
      try {
        const strategyData = JSON.parse(args[2]);
        addStrategy(args[1], strategyData);
      } catch (e) {
        interactiveAdd(args[1]);
      }
    } else {
      interactiveAdd(args[1]);
    }
  } else if (args[0] === 'list') {
    listStrategies();
  } else if (args[0] === 'check') {
    checkErrors();
  } else if (args[0] === 'interactive') {
    const errors = checkErrors();
    if (errors && errors.length > 0) {
      console.log('\n为第一个错误添加策略...');
      interactiveAdd(errors[0].type);
    }
  } else {
    console.log('Usage:');
    console.log('  node core/counter-strategy.js add "错误类型"     添加策略');
    console.log('  node core/counter-strategy.js list            列出所有策略');
    console.log('  node core/counter-strategy.js check           检查需要策略的错误');
  }
}

module.exports = {
  loadStrategies,
  addStrategy,
  listStrategies,
  checkErrors
};
