import { useEffect, useMemo, useState } from 'react';
import { Clock, Zap, CalendarClock, ListTodo, TrendingUp, BarChart3, Trophy, Calendar, Clock3, Target, CheckCircle2, Circle } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type {
  CallbackDataParams,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import * as echarts from 'echarts/core';
import { CustomChart, BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  GraphicComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { studyApi } from '@client/src/api';
import type {
  DashboardStats,
  StudyTask,
  StudySession,
  StudyTodoItem,
  CompletedTaskItem,
} from '@shared/api.interface';

echarts.use([
  BarChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  GraphicComponent,
  CanvasRenderer,
]);

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分钟`;
  if (minutes === 0) return `${hours}小时`;
  return `${hours}小时${minutes}分钟`;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

const StatCard = ({ label, value, icon: Icon }: StatCardProps) => {
  return (
    <Card className="flex-1 overflow-hidden">
      <CardContent className="relative flex flex-col gap-3 p-5 pl-6">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-indigo-500" />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon size={18} strokeWidth={2} />
          </div>
          <span className="text-sm text-slate-500">{label}</span>
        </div>
        <div className="text-3xl font-bold text-slate-800 tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
};

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTaskItem[]>([]);
  const [taskTodosMap, setTaskTodosMap] = useState<Map<string, StudyTodoItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayDisplay = useMemo(() => {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return `${m}月${d}日 · ${weekdays[now.getDay()]}`;
  }, []);

  useEffect(() => {
    const today = getTodayDateString();
    const fetchAll = async (): Promise<void> => {
      try {
        const [statsRes, tasksRes, sessionsRes, completedRes] = await Promise.all([
          studyApi.getDashboardStats(),
          studyApi.getTasks(),
          studyApi.getSessions(today),
          studyApi.getCompletedTasks(),
        ]);
        const activeTasks = tasksRes.items.filter((t: StudyTask) => t.status === 'active');
        setStats(statsRes);
        setTasks(activeTasks);
        setSessions(sessionsRes.items);
        setCompletedTasks(completedRes.items);

        const todoTasks = activeTasks.filter((t: StudyTask) => t.progressMode === 'todo');
        if (todoTasks.length > 0) {
          const todoResults = await Promise.all(
            todoTasks.map((t: StudyTask) => studyApi.getTodoItems(t.id, today)),
          );
          const map = new Map<string, StudyTodoItem[]>();
          todoTasks.forEach((t: StudyTask, i: number) => {
            map.set(t.id, todoResults[i].items);
          });
          setTaskTodosMap(map);
        }
      } catch (err) {
        logger.error('加载仪表盘数据失败', err);
        setError('数据加载失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  const barOption: EChartsOption = useMemo(() => {
    const daily = stats?.dailyStats ?? [];
    const categories = daily.map((d) => {
      const parts = d.date.split('-');
      return `${Number(parts[1])}/${Number(parts[2])}`;
    });
    const values = daily.map((d) => d.totalMinutes);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: TopLevelFormatterParams) => {
          const list = Array.isArray(params) ? params : [params];
          return list
            .map(
              (p) =>
                `${p.name}<br/>学习时长：${formatMinutes(Number(p.value))}`,
            )
            .join('');
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        boundaryGap: true,
      },
      yAxis: {
        type: 'value',
        name: '分钟',
      },
      series: [
        {
          type: 'bar',
          data: values,
          barWidth: '50%',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#4f9dff' },
              { offset: 1, color: '#1e40af' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [stats]);

  const ganttOption: EChartsOption = useMemo(() => {
    const today = getTodayDateString();
    const dayStart = new Date(`${today}T00:00:00`).getTime();
    const dayEnd = new Date(`${today}T23:59:59`).getTime();

    // group sessions by task name for y-axis categories
    const taskMap = new Map<string, { color: string; name: string }>();
    for (const s of sessions) {
      const name = s.taskName ?? '未知任务';
      if (!taskMap.has(name)) {
        taskMap.set(name, { name, color: s.taskColor ?? '#3b82f6' });
      }
    }
    const taskList = Array.from(taskMap.values());
    const taskIndexMap = new Map(taskList.map((t, i) => [t.name, i]));

    const ganttData = sessions
      .filter((s) => s.endTime)
      .map((s: StudySession) => {
        const name = s.taskName ?? '未知任务';
        const idx = taskIndexMap.get(name) ?? 0;
        const startTs = new Date(s.startTime).getTime();
        const endTs = s.endTime ? new Date(s.endTime).getTime() : startTs;
        return {
          name,
          color: s.taskColor ?? '#3b82f6',
          start: startTs,
          end: endTs,
          duration: s.durationSeconds,
          note: s.note,
          categoryIndex: idx,
        };
      });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: TopLevelFormatterParams) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p || p.dataIndex == null) return '';
          const item = ganttData[p.dataIndex];
          if (!item) return '';
          const fmt = (ts: number): string => {
            const d = new Date(ts);
            return `${String(d.getHours()).padStart(2, '0')}:${String(
              d.getMinutes(),
            ).padStart(2, '0')}`;
          };
          const durMin = Math.round(item.duration / 60);
          const noteLine = item.note
            ? `<div style="margin-top:4px;color:#64748b;">备注：${item.note}</div>`
            : '';
          return `${item.name}<br/>${fmt(item.start)} - ${fmt(
            item.end,
          )}<br/>时长：${durMin} 分钟${noteLine}`;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        min: dayStart,
        max: dayEnd,
        axisLabel: {
          formatter: (value: number | string) => {
            const d = new Date(Number(value));
            return `${String(d.getHours()).padStart(2, '0')}:${String(
              d.getMinutes(),
            ).padStart(2, '0')}`;
          },
        },
      },
      yAxis: {
        type: 'category',
        data: taskList.map((t) => t.name),
        inverse: true,
      },
      series: [
        {
          type: 'custom',
          renderItem: (params, api) => {
            const categoryIndex = api.value(0);
            const start = api.coord([api.value(1), categoryIndex]);
            const end = api.coord([api.value(2), categoryIndex]);
            const height = api.size([0, 1])[1] * 0.5;
            const dataIdx = (params as { dataIndex: number }).dataIndex;
            const item = ganttData[dataIdx];
            const color = item?.color ?? '#3b82f6';
            return {
              type: 'rect',
              shape: {
                x: start[0],
                y: start[1] - height / 2,
                width: Math.max(end[0] - start[0], 2),
                height,
              },
              style: { fill: color, radius: 4 },
            };
          },
          encode: { x: [1, 2], y: 0 },
          data: ganttData.map((item) => [
            item.categoryIndex,
            item.start,
            item.end,
          ]),
        },
      ],
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="text-red-500">{error ?? '数据加载失败'}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">仪表盘</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todayDisplay} · 坚持学习，每天进步一点点
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="flex flex-wrap gap-4 mt-2">
        <StatCard
          label="今日学习时长"
          value={formatMinutes(stats.todayMinutes)}
          icon={Clock}
        />
        <StatCard
          label="今日学习次数"
          value={`${stats.todaySessions} 次`}
          icon={Zap}
        />
        <StatCard
          label="本周学习时长"
          value={formatMinutes(stats.weekMinutes)}
          icon={CalendarClock}
        />
        <StatCard
          label="进行中任务"
          value={`${stats.activeTasks} 个`}
          icon={ListTodo}
        />
      </div>

      {/* 今日学习时段 */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BarChart3 size={16} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">今日学习时段</CardTitle>
              <p className="text-xs text-slate-400">按时间线查看今日学习分布</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
              暂无学习记录
            </div>
          ) : (
            <ReactECharts
              option={ganttOption}
              theme="ud"
              className="h-[300px] w-full"
            />
          )}
        </CardContent>
      </Card>

      {/* 最近7天学习时长 */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp size={16} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">最近 7 天学习时长</CardTitle>
              <p className="text-xs text-slate-400">查看近一周的学习趋势</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(stats.dailyStats?.length ?? 0) === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
              暂无数据
            </div>
          ) : (
            <ReactECharts
              option={barOption}
              theme="ud"
              className="h-[300px] w-full"
            />
          )}
        </CardContent>
      </Card>

      {/* 任务进度列表 */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ListTodo size={16} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">任务进度概览</CardTitle>
              <p className="text-xs text-slate-400">进行中任务的完成情况</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-sm text-slate-400">暂无进行中的任务</div>
          ) : (
            <div className="space-y-4">
               {tasks.map((task: StudyTask) => {
                 const isTodoMode = task.progressMode === 'todo';
                 const hasTarget = task.targetTotal != null && task.targetTotal > 0;
                 const todos = taskTodosMap.get(task.id) ?? [];
                 const completedCount = todos.filter((t: StudyTodoItem) => t.completed).length;
                 const totalCount = todos.length;
                 const todoPercent = totalCount > 0
                   ? Math.round((completedCount / totalCount) * 100)
                   : 0;
                 const percent = hasTarget
                   ? Math.min(
                       100,
                       Math.round(
                         (task.currentProgress / (task.targetTotal as number)) * 100,
                       ),
                     )
                   : 0;
                return (
                  <div key={task.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: task.color }}
                        />
                        <span className="truncate text-sm font-medium text-slate-800">
                          {task.name}
                        </span>
                        <span
                          className={`inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            isTodoMode
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          {isTodoMode ? (
                            <ListTodo className="mr-0.5 size-2.5" />
                          ) : (
                            <Target className="mr-0.5 size-2.5" />
                          )}
                          {isTodoMode ? 'ToDo' : '定量'}
                        </span>
                      </div>
                       <div className="flex-shrink-0 text-sm text-slate-500">
                         {isTodoMode ? (
                           totalCount > 0 ? (
                             <>
                               已完成 {completedCount} / {totalCount} 项
                               <span className="ml-2 font-semibold text-slate-700">
                                 {todoPercent}%
                               </span>
                             </>
                           ) : (
                             <span className="text-slate-400">暂无待办项</span>
                           )
                         ) : hasTarget ? (
                           <>
                             {task.currentProgress} / {task.targetTotal}{' '}
                             {task.progressUnit}
                             <span className="ml-2 font-semibold text-slate-700">
                               {percent}%
                             </span>
                           </>
                         ) : (
                           <>
                             {task.currentProgress} {task.progressUnit}
                           </>
                         )}
                       </div>
                    </div>
                      {isTodoMode && totalCount > 0 && (
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${todoPercent}%`,
                              background: `linear-gradient(90deg, ${task.color}, ${task.color}dd)`,
                            }}
                          />
                        </div>
                      )}
                      {isTodoMode && totalCount > 0 && (
                        <ol className="list-decimal list-inside space-y-1.5 pl-1 text-sm text-slate-600">
                          {todos.map((item: StudyTodoItem, idx: number) => (
                            <li
                              key={item.id}
                              className={`flex items-start gap-2 ${
                                item.completed ? 'text-slate-400' : ''
                              }`}
                            >
                              <span className="flex-shrink-0 text-slate-400">{idx + 1}.</span>
                              {item.completed ? (
                                <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-emerald-500" />
                              ) : (
                                <Circle className="mt-0.5 size-4 flex-shrink-0 text-slate-300" />
                              )}
                              <span
                                className={`flex-1 ${
                                  item.completed ? 'line-through text-slate-400' : 'text-slate-700'
                                }`}
                              >
                                {item.content}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                     {!isTodoMode && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: hasTarget ? `${percent}%` : '100%',
                            background: hasTarget
                              ? `linear-gradient(90deg, ${task.color}, ${task.color}dd)`
                              : '#e2e8f0',
                            opacity: hasTarget ? 1 : 0.4,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 成就墙 */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy size={16} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">成就墙</CardTitle>
              <p className="text-xs text-slate-400">
                已完成 {completedTasks.length} 个任务，继续加油
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {completedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Trophy className="size-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">还没有完成的任务</p>
              <p className="mt-1 text-xs text-slate-400">
                完成第一个任务后，它会出现在这里
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedTasks.map((task: CompletedTaskItem) => {
                const completedDate = new Date(task.completedAt);
                const y = completedDate.getFullYear();
                const m = String(completedDate.getMonth() + 1).padStart(2, '0');
                const d = String(completedDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                return (
                  <div
                    key={task.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-transparent hover:shadow-md"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        background: `linear-gradient(90deg, ${task.color}, ${task.color}aa)`,
                      }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-800">
                          {task.name}
                        </h3>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <Trophy className="size-3.5" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        <span>{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        <span>{task.totalMinutes} 分钟</span>
                      </div>
                    </div>
                    {task.targetTotal != null && task.targetTotal > 0 && (
                      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>最终进度</span>
                          <span className="font-medium text-slate-700">
                            {task.finalProgress} / {task.targetTotal} {task.progressUnit}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (task.finalProgress / (task.targetTotal as number)) * 100,
                                ),
                              )}%`,
                              backgroundColor: task.color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {task.isDailyTask && (
                      <div className="mt-3">
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          每日任务
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
