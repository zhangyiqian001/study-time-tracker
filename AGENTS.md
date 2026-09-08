# 学习记录应用 · 研发规范

## 应用概览

学习记录应用，帮助用户管理学习任务、记录学习时长与进度。包含仪表盘、任务管理、学习计时三个核心页面。

- 技术栈：NestJS + React + Drizzle + Postgres
- 核心实体：学习任务（study_task）、学习会话（study_session）、进度日志（study_progress_log）

## 设计规范

### 色彩系统
- 主色调：`#3b82f6`（蓝色系，沉稳专注）
- 辅助色：`#6366f1`（靛蓝点缀）
- 成功色：`#10b981`
- 危险色：`#ef4444`
- 背景色：`#f8fafc`（slate-50）
- 卡片背景：纯白 `#ffffff`
- 文字主色：`#1e293b`（slate-800）
- 文字次色：`#64748b`（slate-500）
- 分割线/边框：`#e2e8f0`（slate-200）

### 间距系统
- 页面内边距：`p-6`（24px）
- 卡片内边距：`p-5`（20px）
- 元素间距：`gap-4`（16px）为主，紧密处 `gap-3`（12px）
- 区块间距：`mt-8`（32px）

### 圆角
- 卡片圆角：`rounded-xl`（12px）
- 按钮圆角：`rounded-md`（6px）
- 输入框圆角：`rounded-md`（6px）
- 小标签圆点：`rounded-full`

### 阴影
- 卡片阴影：轻阴影 `shadow-sm`
- 按钮悬浮：内置 hover-elevate

### 字体与层级
- 大标题：`text-lg font-semibold`
- 卡片数值：`text-3xl font-bold`
- 正文：`text-sm text-slate-600`
- 辅助说明：`text-xs text-slate-400`
- 计时器数字：`font-mono font-bold`

### 布局约定
- 内容最大宽度：`max-w-4xl` 居中
- 统计卡片：`flex flex-wrap gap-4`，卡片 `flex-1`
- 图表卡片：全宽独立卡片，上下堆叠
- 响应式：移动端自适应，保持单列
