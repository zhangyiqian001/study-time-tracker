# 学习时光记录 (Study Time Tracker)

每日学习任务管理应用：设置学习任务 → 打开计时器学习 → 用甘特图记录每天的学习时段，并追踪每个任务的长期进度。

## 功能特性

- **任务管理**：自由创建学习任务（学英语、背单词、看书等），支持设定每日任务与每日最低学习时长
- **学习计时**：点击开始/结束记录每次学习，自动生成"几点到几点"的学习时段
- **甘特图视图**：按天展示学习时段分布，悬浮时段块可查看学习备注
- **双模式进度追踪**：
  - **定量目标模式**：像书一样设定总目标（如 4000 词、220 页），每次学习录入本次完成量并自动累加，达到总量自动标记完成（超量会被拦截）
  - **ToDo 清单模式**：没有数字总量目标，每天添加待办项、逐项勾选完成，按清单跟踪进度
- **每日任务强制机制**：当天每日任务未学满最低时长前，其他任务无法开始计时
- **任务成就墙**：首页集中展示所有已完成的任务及成果
- **数据持久化**：任务、学习记录、进度、待办全部入库，跨天保留

## 技术栈

- **前端**：React + TypeScript + Vite + Tailwind CSS + ECharts（甘特图/柱状图）
- **后端**：NestJS + Drizzle ORM + PostgreSQL
- **平台**：基于妙搭（Lark Apaas）平台，使用 `@lark-apaas/*` 平台 SDK（身份认证、数据库连接等）

## 目录结构

```
├── client/          # React 前端源码
│   └── src/
│       ├── pages/   # 仪表盘 / 任务管理 / 学习计时 等页面
│       ├── api/     # 前后端接口封装
│       └── components/
├── server/          # NestJS 后端源码
│   ├── modules/study/    # 学习核心业务（任务/计时/进度/待办）
│   └── database/schema.ts  # Drizzle 数据库表定义
├── shared/          # 前后端共享类型定义
├── scripts/         # 项目脚本
└── ...              # 工程配置（tsconfig / vite / tailwind / eslint 等）
```

## 数据库

核心表（定义见 `server/database/schema.ts`，基于 Drizzle ORM）：

| 表 | 说明 |
|---|---|
| `study_task` | 学习任务（名称、颜色、目标总量、当前进度、进度模式、是否每日任务等） |
| `study_session` | 学习时段（开始/结束时间、时长、备注） |
| `study_progress_log` | 进度录入日志（每次录入量、备注） |
| `study_todo_item` | ToDo 清单待办项（内容、完成状态、日期） |

## 运行说明

> 注意：`package.json` 中 `@lark-apaas/*` 系列依赖为妙搭平台 SDK，仅可在妙搭平台环境安装运行。核心业务逻辑（client / server / shared 下的业务代码）可复用；如需在其他平台运行，需将身份认证、数据库连接、文件存储等部分替换为对应平台的实现。

```bash
# 安装依赖
npm install

# 启动前端 devServer
npm run dev:client

# 启动后端 devServer
npm run dev:server
```

## License

MIT
