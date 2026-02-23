# 🧠 Cognitive-OS V1

个人 AI 认知进化系统 - 本地运行、Git 版本化、强干预启动

## 什么是 Cognitive-OS？

Cognitive-OS 是一个帮助你追踪、分析和改进认知模式的本地系统。它不是普通的日志工具，而是一个**具有约束能力的认知进化系统**。

### 核心理念

- **数据主权**：所有数据存储在本地，不依赖任何云服务
- **行为闭环**：不只是记录，还要干预和修正
- **强干预**：系统可以限制你的行为（如禁止新增项目）
- **模型无关**：不依赖任何特定 AI 模型

---

## 核心能力

1. **会话记录** - 结构化记录每日决策、错误、精力状态
2. **模式识别** - 自动识别重复错误和高频主题
3. **强干预系统** - 根据规则自动触发行为约束
4. **启动报告** - 每次启动生成认知分析报告
5. **Git 同步** - 自动备份到私有仓库

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/skyconnfig/cognitive-os.git
cd cognitive-os
```

### 2. 运行系统

```bash
# 启动并生成报告
node core/bootstrap.js

# 快速检查状态
node core/bootstrap.js --check

# 设置今日目标
node core/bootstrap.js --goal "完成某个任务"
```

---

## 目录结构

```
cognitive-os/
├── core/                    # 核心模块
│   ├── bootstrap.js         # 启动入口
│   ├── state-manager.js    # 状态管理
│   ├── intervention-engine.js # 干预引擎
│   ├── reflection-engine.js  # 反思引擎
│   ├── analysis-engine.js   # 分析引擎
│   └── git-sync.js        # Git 同步
├── memory/                 # 数据存储
│   ├── timeline/          # 每日记录
│   ├── state.json        # 当前状态
│   ├── errors.json       # 错误数据库
│   ├── unresolved.json   # 未完成事项
│   └── patterns.json     # 模式数据
├── reports/               # 启动报告
└── .config.json          # 配置文件
```

---

## 使用方法

### 每日使用流程

1. **启动时**：运行 `node core/bootstrap.js` 获取启动报告
2. **工作中**：记录关键决策和错误
3. **结束时**：系统自动同步到 Git

### 记录数据

```javascript
const reflection = require('./core/reflection-engine');

// 记录主话题
reflection.setMainTopic("开发认知系统");

// 设置精力状态
reflection.setEnergyState('high'); // high | neutral | low

// 记录决策
reflection.addDecision("使用 Node.js 而非 Python", "因为更熟悉");

// 记录错误
reflection.addMistake("过度架构", "为小功能创建了复杂结构");

// 记录未完成事项
reflection.addUnfinished("完成 README 文档");

// 记录洞见
reflection.addInsight("干预系统需要清晰阈值");
```

### 设置目标

```bash
# 设置今日唯一目标
node core/bootstrap.js --goal "完成 cognitive-os 的 README"
```

---

## 干预系统

这是 Cognitive-OS 与普通日志系统的核心区别。

### 干预等级

| 等级 | 名称 | 行为 |
|------|------|------|
| 1 | 轻度 | 提醒和警告 |
| 2 | 中度 | 限制扩展 + 要求写反制策略 |
| 3 | 重度 | 禁止新增 + 强制完成旧任务 |

### 触发规则

| 条件 | 动作 | 等级 |
|------|------|------|
| 连续 7 天新增项目 | 锁定扩展 | 2 |
| 同一错误出现 3 次 | 强制写 counter_strategy | 2 |
| 未完成事项 > 5 个 | 禁止新增 | 3 |
| 连续 3 天精力分散 | 警告 | 1 |

### 查看干预状态

```bash
node core/bootstrap.js --check
```

输出示例：
```
🧠 Cognitive-OS 状态检查
  干预等级: 2
  专注模式: neutral
  扩展锁定: 是 ⚠️
  限制原因: 连续 7 天新增项目，已锁定扩展
```

---

## 命令参考

### Bootstrap

```bash
# 完整启动报告
node core/bootstrap.js

# 快速检查
node core/bootstrap.js --check

# 设置目标
node core/bootstrap.js --goal "你的目标"
```

### Git 同步

```bash
# 自动提交并推送
node core/git-sync.js sync

# 仅提交
node core/git-sync.js push

# 仅推送
node core/git-sync.js pull

# 查看状态
node core/git-sync.js status
```

---

## 数据结构

### Timeline (每日记录)

```json
{
  "date": "2026-02-23",
  "main_topic": "认知系统开发",
  "decisions": [
    { "decision": "使用 Node.js", "context": "更熟悉", "timestamp": "..." }
  ],
  "mistakes": [
    { "mistake": "过度架构", "type": "认知偏差", "timestamp": "..." }
  ],
  "energy_state": "high",
  "unfinished_threads": ["完成 README"],
  "insights": ["干预需要阈值"],
  "self_bias_detected": []
}
```

### 错误数据库

```json
[
  {
    "type": "过度架构",
    "category": "认知偏差",
    "first_seen": "2026-02-23",
    "last_seen": "2026-02-23",
    "occurrences": 1,
    "trigger_context": [],
    "behavioral_pattern": "",
    "counter_strategy": "",
    "severity_level": 1,
    "status": "active"
  }
]
```

---

## 配置

编辑 `.config.json`：

```json
{
  "analysis_days": 7,
  "auto_git_commit": true,
  "intervention_enabled": true,
  "report_format": "text"
}
```

---

## 注意事项

1. **数据本地存储**：所有数据在 `memory/` 目录，Git 会同步
2. **隐私**：如果你在意隐私，可以将 `memory/` 加入 `.gitignore`
3. **干预是善意的**：系统限制你是为了帮助你专注，遵守规则会获得更好效果

---

## 未来方向 (V2)

- 本地 embedding（语义搜索）
- 模式聚类
- 决策偏差检测
- 能量曲线可视化

---

---

## 🚀 长期记忆与 OpenCode 集成

Cognitive-OS 现在具备了通过本地 Ollama 实现的**长期记忆系统**。这不仅是你的认知归档，更是 AI 代理（如 OpenCode）的“外挂大脑”。

### 1. 开发者如何“喂养”记忆
运行以下脚本，系统会自动从 OpenCode 导出今日对话、提取认知模式并完成向量化索引：
```powershell
.\import-today.ps1
```
> [!TIP]
> 想要一次性导入所有历史记录？运行 `node core/auto-importer.js --all` 后执行 `node core/memory-engine.js sync`。

### 2. 如何在 OpenCode 中使用
你可以直接在对话中指挥代理调用记忆。例如：
- **查错**：“帮我查一下，我之前在做这个项目时遇到过什么类似的错误？” -> *代理会自动检索历史 Bug 方案。*
- **溯源**：“带我回顾一下上周关于架构选型的决策背景。” -> *代理会跨越会话边界调取相关记录。*
- **唤醒**：“搜一下我之前对这个功能的实现思路。”

### 3. 给 AI 代理的“系统提示词”建议
如果你想让代理变得更聪明，可以在 OpenCode 的“系统提示词”或项目指令中加入：
> “在处理任务前，请优先通过运行 `node core/memory-cli.js "关键词"` 检索我的长期记忆库（Cognitive-OS），以获取历史偏好、决策背景或已知错误解决方案。”

### 4. 核心工具指令
- **命令行搜索**：`node core/memory-cli.js "你的关键词"`
- **全量同步**：`node core/memory-engine.js sync`

---

## 许可证

MIT

---

**让认知进化，从今天开始。**
