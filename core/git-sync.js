/**
 * Git Sync - 自动 Git 同步
 * 
 * 核心职责：
 * - 自动 Git 提交
 * - 私有仓库同步
 * - 永不删除历史
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const COGNITIVE_OS_DIR = __dirname;

/**
 * 检查是否在 Git 仓库中
 */
function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { 
      cwd: COGNITIVE_OS_DIR,
      stdio: 'ignore'
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 初始化 Git 仓库
 */
function initRepo(remoteUrl = null) {
  if (isGitRepo()) {
    console.log('[GitSync] 已经是 Git 仓库');
    return false;
  }
  
  try {
    // 初始化仓库
    execSync('git init', { cwd: COGNITIVE_OS_DIR });
    console.log('[GitSync] Git 仓库已初始化');
    
    // 添加远程仓库
    if (remoteUrl) {
      execSync(`git remote add origin ${remoteUrl}`, { cwd: COGNITIVE_OS_DIR });
      console.log('[GitSync] 远程仓库已添加');
    }
    
    return true;
  } catch (e) {
    console.error('[GitSync] 初始化失败:', e.message);
    return false;
  }
}

/**
 * 检查是否有未提交的更改
 */
function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { 
      cwd: COGNITIVE_OS_DIR,
      encoding: 'utf-8'
    });
    return status.trim().length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * 获取今天的提交消息前缀
 */
function getCommitMessagePrefix() {
  const today = new Date().toISOString().split('T')[0];
  return `brain update: ${today}`;
}

/**
 * 自动提交
 */
function autoCommit(message = null) {
  if (!isGitRepo()) {
    console.log('[GitSync] 未初始化 Git，跳过提交');
    return { success: false, reason: 'not a git repo' };
  }
  
  if (!hasChanges()) {
    console.log('[GitSync] 没有需要提交的更改');
    return { success: true, reason: 'no changes' };
  }
  
  try {
    // 添加所有更改
    execSync('git add -A', { cwd: COGNITIVE_OS_DIR });
    
    // 生成提交消息
    const commitMsg = message || getCommitMessagePrefix();
    
    // 提交
    execSync(`git commit -m "${commitMsg}"`, { cwd: COGNITIVE_OS_DIR });
    console.log(`[GitSync] 已提交: ${commitMsg}`);
    
    return { success: true, message: commitMsg };
  } catch (e) {
    console.error('[GitSync] 提交失败:', e.message);
    return { success: false, reason: e.message };
  }
}

/**
 * 推送到远程
 */
function push(branch = 'main') {
  if (!isGitRepo()) {
    return { success: false, reason: 'not a git repo' };
  }
  
  try {
    // 检查是否有远程仓库
    try {
      execSync('git remote -v', { cwd: COGNITIVE_OS_DIR, stdio: 'ignore' });
    } catch (e) {
      console.log('[GitSync] 没有配置远程仓库，跳过推送');
      return { success: false, reason: 'no remote' };
    }
    
    // 推送
    execSync(`git push -u origin ${branch}`, { cwd: COGNITIVE_OS_DIR });
    console.log(`[GitSync] 已推送到 ${branch}`);
    
    return { success: true };
  } catch (e) {
    console.error('[GitSync] 推送失败:', e.message);
    return { success: false, reason: e.message };
  }
}

/**
 * 自动同步（提交 + 推送）
 */
function sync(message = null) {
  console.log('[GitSync] 开始同步...');
  
  const commitResult = autoCommit(message);
  if (!commitResult.success) {
    return commitResult;
  }
  
  if (commitResult.reason === 'no changes') {
    return commitResult;
  }
  
  const pushResult = push();
  
  return {
    success: commitResult.success && pushResult.success,
    commit: commitResult,
    push: pushResult
  };
}

/**
 * 拉取最新
 */
function pull(branch = 'main') {
  if (!isGitRepo()) {
    return { success: false, reason: 'not a git repo' };
  }
  
  try {
    execSync(`git pull origin ${branch}`, { cwd: COGNITIVE_OS_DIR });
    console.log('[GitSync] 已拉取最新');
    return { success: true };
  } catch (e) {
    console.error('[GitSync] 拉取失败:', e.message);
    return { success: false, reason: e.message };
  }
}

/**
 * 获取最近的提交历史
 */
function getRecentCommits(count = 5) {
  if (!isGitRepo()) {
    return [];
  }
  
  try {
    const log = execSync(`git log --oneline -n ${count}`, { 
      cwd: COGNITIVE_OS_DIR,
      encoding: 'utf-8'
    });
    return log.trim().split('\n');
  } catch (e) {
    return [];
  }
}

/**
 * 配置 Git（用户信息）
 */
function configureGit(username, email) {
  try {
    execSync(`git config user.name "${username}"`, { cwd: COGNITIVE_OS_DIR });
    execSync(`git config user.email "${email}"`, { cwd: COGNITIVE_OS_DIR });
    console.log('[GitSync] Git 用户信息已配置');
    return true;
  } catch (e) {
    console.error('[GitSync] 配置失败:', e.message);
    return false;
  }
}

// 主入口
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'init' && args[1]) {
    initRepo(args[1]);
  } else if (args[0] === 'sync') {
    sync();
  } else if (args[0] === 'push') {
    push();
  } else if (args[0] === 'pull') {
    pull();
  } else if (args[0] === 'status') {
    console.log('Changes:', hasChanges());
  } else {
    console.log('Usage:');
    console.log('  node git-sync.js init <remote-url>');
    console.log('  node git-sync.js sync');
    console.log('  node git-sync.js push');
    console.log('  node git-sync.js pull');
  }
}

module.exports = {
  isGitRepo,
  initRepo,
  hasChanges,
  autoCommit,
  push,
  sync,
  pull,
  getRecentCommits,
  configureGit
};
