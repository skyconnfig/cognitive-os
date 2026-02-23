---
name: cognitive-os-memory
description: Cognitive-OS 长期记忆系统 - 提供语义搜索、决策溯源、错误查询、同步索引等记忆检索能力
version: 1.1.0
source: local-repo-custom
domain: memory-retrieval
triggers:
  - "查一下我之前"
  - "搜索记忆"
  - "检索"
  - "回顾"
  - "之前遇到过"
  - "查错"
  - "溯源"
  - "唤醒"
  - "同步记忆"
  - "同步索引"
  - "导入记忆"
  - "导入今日"
---

# 🧠 Cognitive-OS 记忆系统

你的长期记忆系统，提供语义搜索、决策溯源、错误查询和索引同步能力。

## 核心功能

### 1. 记忆搜索 (主要功能)

当用户需要检索记忆时，执行：
```bash
node core/memory-cli.js "搜索关键词"
```

**执行步骤**：
1. 提取用户搜索的关键词
2. 在终端执行 `node core/memory-cli.js "关键词"`
3. 格式化输出结果给用户

### 2. 全量同步

当用户说"同步索引"、"同步记忆"时，执行：
```bash
node core/memory-engine.js sync
```

**执行步骤**：
1. 在终端执行同步命令
2. 等待索引完成
3. 报告同步结果（索引了多少条记录）

### 3. 今日记忆导入

当用户说"导入记忆"、"导入今日"时，执行：
```powershell
.\import-today.ps1
```

**执行步骤**：
1. 运行 PowerShell 脚本导入今日对话
2. 等待导入完成
3. 可选：自动执行 `node core/memory-engine.js sync` 更新索引

## 常见使用场景

### 查错 - 检索历史 Bug 解决方案
```
用户: "帮我查一下，我之前在做这个项目时遇到过什么类似的错误？"
操作: 执行 `node core/memory-cli.js "错误 解决方案"`
```

### 溯源 - 回顾架构决策背景
```
用户: "带我回顾一下上周关于架构选型的决策背景。"
操作: 执行 `node core/memory-cli.js "架构选型 决策"`
```

### 唤醒 - 搜索实现思路
```
用户: "搜一下我之前对这个功能的实现思路。"
操作: 执行 `node core/memory-cli.js "实现思路 功能"`
```

### 同步索引
```
用户: "帮我同步一下记忆索引"
操作: 执行 `node core/memory-engine.js sync`
```

### 导入今日记忆
```
用户: "导入今天的记忆"
操作: 执行 `.\import-today.ps1`
```

## 输出格式

检索结果示例：
```
[1] 【85% 相关】 2026-02-20 [decision]
    内容: 使用 Node.js 而非 Python (背景: 因为更熟悉)
    Session ID: ses_xxx

[2] 【72% 相关】 2026-02-19 [mistake]
    内容: 过度架构 (类型: 认知偏差)
```

## 数据类型

| 类型 | 说明 |
|------|------|
| `topic` | 主话题/主题 |
| `decision` | 决策记录 |
| `mistake` | 错误/偏差记录 |
| `insight` | 洞见/领悟 |

## 故障排除

### 未找到结果
- 尝试运行 `node core/memory-engine.js sync` 同步索引
- 使用更通用的关键词

### Ollama 连接失败
- 确保 Ollama 正在运行
- 确认模型已安装: `ollama pull all-minilm`

### 搜索无响应
- 检查 Ollama 服务: `curl http://localhost:11434/api/tags`

## 依赖

- Node.js 18+
- Ollama (本地运行)
- all-minilm 模型

## 工作目录

注意：所有命令需要在 Cognitive-OS 项目目录执行：
- Windows: `D:\cognitive-os\` 或 `C:\Users\lixin\cognitive-os\`
- 可以通过 `cd /d cognitive-os` 切换
