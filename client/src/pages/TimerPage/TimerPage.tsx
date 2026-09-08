import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Play, Pause, Square, Clock, BookOpen, Timer, Flame, CheckCircle2, AlertTriangle, CalendarClock, ListTodo, Plus, X } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { studyApi } from '@client/src/api';
import type { StudyTask, StudySession, StartSessionBlockedResponse, StudyTodoItem } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Card,
  CardContent,
} from '@client/src/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@client/src/components/ui/dialog';

type TimerStatus = 'idle' | 'running' | 'paused';

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TimerPage: React.FC = () => {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [displaySeconds, setDisplaySeconds] = useState<number>(0);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressAmount, setProgressAmount] = useState<string>('');
  const [progressNote, setProgressNote] = useState<string>('');
  const [sessionNote, setSessionNote] = useState<string>('');
  const [submittingProgress, setSubmittingProgress] = useState(false);
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [todoItems, setTodoItems] = useState<StudyTodoItem[]>([]);
  const [newTodoContent, setNewTodoContent] = useState('');
  const [todoLoading, setTodoLoading] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);

  const todayDisplay = useMemo(() => {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return `${m}月${d}日 · ${weekdays[now.getDay()]}`;
  }, []);

  const timerRef = useRef<number | null>(null);
  const baseEpochRef = useRef<number>(0);
  const pausedSecondsRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTicking = useCallback(() => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const nowMs = Date.now();
      const elapsed = Math.floor((nowMs - baseEpochRef.current) / 1000);
      setDisplaySeconds(pausedSecondsRef.current + elapsed);
    }, 1000);
  }, [clearTimer]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await studyApi.getTasks();
      setTasks(res.items);
    } catch (error) {
      logger.error('获取任务列表失败', error);
      toast.error('获取任务列表失败');
    }
  }, []);

  const fetchSessions = useCallback(async (date: string) => {
    try {
      const res = await studyApi.getSessions(date);
      setSessions(res.items);
    } catch (error) {
      logger.error('获取今日学习记录失败', error);
    }
  }, []);

  const loadActiveSession = useCallback(async () => {
    try {
      const session = await studyApi.getActiveSession();
      if (session) {
        setActiveSession(session);
        const startMs = new Date(session.startTime).getTime();
        baseEpochRef.current = startMs;
        pausedSecondsRef.current = 0;
        setDisplaySeconds(Math.floor((Date.now() - startMs) / 1000));
        setStatus('running');
        if (session.taskId) {
          setSelectedTaskId(session.taskId);
        }
        startTicking();
      }
    } catch (error) {
      logger.error('获取进行中的学习失败', error);
    }
  }, [startTicking]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await fetchTasks();
      await loadActiveSession();
      await fetchSessions(getTodayDateStr());
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
      clearTimer();
    };
  }, [fetchTasks, loadActiveSession, fetchSessions, clearTimer]);

  const currentTask = useMemo(() => {
    if (activeSession?.taskId) {
      const t = tasks.find((tk: StudyTask) => tk.id === activeSession.taskId);
      if (t) return t;
    }
    return tasks.find((tk: StudyTask) => tk.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId, activeSession]);

  const handleStart = async () => {
    if (!selectedTaskId) {
      toast.warning('请先选择一个学习任务');
      return;
    }
    const task = tasks.find((t: StudyTask) => t.id === selectedTaskId);
    const isTodoMode = task?.progressMode === 'todo';

    if (isTodoMode) {
      try {
        setTodoLoading(true);
        const res = await studyApi.getTodoItems(selectedTaskId, getTodayDateStr());
        setTodoItems(res.items);
        setSelectedTodoIds([]);
        setNewTodoContent('');
        if (res.items.length === 0) {
          setTodoDialogOpen(true);
          return;
        }
      } catch (error) {
        logger.error('获取今日待办失败', error);
        toast.error('获取今日待办失败');
        return;
      } finally {
        setTodoLoading(false);
      }
    }

    await doStartSession(selectedTaskId);
  };

  const doStartSession = async (taskId: string) => {
    try {
      const result = await studyApi.startSession({ taskId });
      if ('blocked' in result && result.blocked) {
        const blocked = result as StartSessionBlockedResponse;
        toast.warning(
          `每日任务「${blocked.dailyTaskName}」还需完成 ${blocked.remainingMinutes} 分钟，请先完成每日任务`,
          { duration: 5000 },
        );
        return;
      }
      const session = result as StudySession;
      setActiveSession(session);
      const startMs = new Date(session.startTime).getTime();
      baseEpochRef.current = startMs;
      pausedSecondsRef.current = 0;
      setDisplaySeconds(Math.floor((Date.now() - startMs) / 1000));
      setStatus('running');
      startTicking();
      toast.success('开始学习，加油！');
    } catch (error) {
      logger.error('开始学习失败', error);
      toast.error('开始学习失败');
    }
  };

  const handleAddTodo = async () => {
    if (!selectedTaskId) return;
    const content = newTodoContent.trim();
    if (!content) {
      toast.warning('请输入待办内容');
      return;
    }
    try {
      const newItem = await studyApi.createTodo(selectedTaskId, content, getTodayDateStr());
      setTodoItems((prev) => [...prev, newItem]);
      setNewTodoContent('');
      toast.success('已添加待办');
    } catch (error) {
      logger.error('添加待办失败', error);
      toast.error('添加待办失败');
    }
  };

  const handleStartWithTodo = async () => {
    if (!selectedTaskId) return;
    if (todoItems.length === 0) {
      toast.warning('请至少添加一项今日待办再开始');
      return;
    }
    setTodoDialogOpen(false);
    await doStartSession(selectedTaskId);
  };

  const handlePause = () => {
    clearTimer();
    const elapsed = Math.floor((Date.now() - baseEpochRef.current) / 1000);
    pausedSecondsRef.current += elapsed;
    setDisplaySeconds(pausedSecondsRef.current);
    setStatus('paused');
  };

  const handleResume = () => {
    baseEpochRef.current = Date.now();
    setStatus('running');
    startTicking();
  };

  const handleEnd = async () => {
    if (!activeSession) {
      clearTimer();
      setStatus('idle');
      setDisplaySeconds(0);
      pausedSecondsRef.current = 0;
      return;
    }
    setProgressAmount('');
    setProgressNote('');
    setSessionNote('');
    setSelectedTodoIds([]);

    const taskId = activeSession.taskId;
    const task = tasks.find((t: StudyTask) => t.id === taskId);
    if (task?.progressMode === 'todo') {
      try {
        const res = await studyApi.getTodoItems(taskId, getTodayDateStr());
        setTodoItems(res.items);
      } catch (error) {
        logger.error('获取今日待办失败', error);
        setTodoItems([]);
      }
    }
    setProgressDialogOpen(true);
  };

  const handleConfirmEnd = async (withProgress: boolean) => {
    if (!activeSession) return;
    const taskId = activeSession.taskId;
    const task = tasks.find((t: StudyTask) => t.id === taskId);
    const isTodoMode = task?.progressMode === 'todo';

    if (isTodoMode) {
      if (selectedTodoIds.length === 0) {
        toast.warning('请至少选择一项待办标记为完成');
        return;
      }
    }

    if (withProgress) {
      const amount = Number(progressAmount);
      if (!progressAmount || Number.isNaN(amount) || amount <= 0) {
        toast.warning('请输入有效的进度数量');
        return;
      }
      if (currentTask?.targetTotal) {
        const remaining = (currentTask.targetTotal as number) - currentTask.currentProgress;
        if (amount > remaining + 0.001) {
          toast.warning(`本次完成量不能超过剩余进度 ${remaining} ${currentTask.progressUnit}`);
          return;
        }
      }
    }

    setSubmittingProgress(true);
    try {
      await studyApi.endSession({
        sessionId: activeSession.id,
        note: sessionNote || undefined,
        completedTodoIds: isTodoMode ? selectedTodoIds : undefined,
      });

      if (withProgress) {
        await studyApi.addProgress({
          taskId,
          amount: Number(progressAmount),
          note: progressNote || undefined,
          logDate: getTodayDateStr(),
        });
        toast.success(`学习已结束，进度 +${progressAmount} ${currentTask?.progressUnit || '个'}`);
      } else {
        toast.success('学习已结束');
      }

      clearTimer();
      setStatus('idle');
      setDisplaySeconds(0);
      pausedSecondsRef.current = 0;
      setActiveSession(null);
      setProgressDialogOpen(false);
      await fetchSessions(getTodayDateStr());
      await fetchTasks();
    } catch (error) {
      logger.error('结束学习失败', error);
      toast.error('结束学习失败');
    } finally {
      setSubmittingProgress(false);
    }
  };

  const { todayMinutes, todaySessions } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    let totalMinutes = 0;
    let sessionCount = 0;

    for (const s of sessions) {
      if (!s.endTime) continue;
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      if (end < todayStartMs) continue;
      const effectiveStart = Math.max(start, todayStartMs);
      const minutes = Math.round((end - effectiveStart) / 60000);
      totalMinutes += minutes;
      sessionCount += 1;
    }

    return {
      todayMinutes: totalMinutes,
      todaySessions: sessionCount,
    };
  }, [sessions]);

  const statusText = useMemo(() => {
    if (status === 'running' && currentTask) {
      return `正在学习：${currentTask.name}`;
    }
    if (status === 'paused' && currentTask) {
      return `已暂停：${currentTask.name}`;
    }
    return '选择一个任务开始学习吧';
  }, [status, currentTask]);

  const dailyTaskStatus = useMemo(() => {
    const dailyTask = tasks.find(
      (t: StudyTask) => t.isDailyTask && t.status === 'active' && (t.dailyMinMinutes ?? 0) > 0,
    );
    if (!dailyTask) {
      return { hasDailyTask: false, isMet: true, todayMinutes: 0, targetMinutes: 0, remainingMinutes: 0, taskName: '' };
    }
    const targetMinutes = dailyTask.dailyMinMinutes ?? 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    let todayMinutes = 0;
    for (const s of sessions) {
      if (s.taskId !== dailyTask.id) continue;
      if (!s.endTime) continue;
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      if (end < todayStartMs) continue;
      const effectiveStart = Math.max(start, todayStartMs);
      todayMinutes += Math.round((end - effectiveStart) / 60000);
    }

    const remaining = Math.max(0, targetMinutes - todayMinutes);
    return {
      hasDailyTask: true,
      isMet: todayMinutes >= targetMinutes,
      todayMinutes,
      targetMinutes,
      remainingMinutes: remaining,
      taskName: dailyTask.name,
    };
  }, [tasks, sessions]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">学习计时</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todayDisplay} · 专注当下，高效学习
          </p>
        </div>

        {/* 每日任务状态提示 */}
        {dailyTaskStatus.hasDailyTask && (
          <Card
            className={`mb-6 border overflow-hidden ${
              dailyTaskStatus.isMet
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  dailyTaskStatus.isMet
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                {dailyTaskStatus.isMet ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">
                  {dailyTaskStatus.isMet
                    ? '今日每日任务已完成，真棒！'
                    : `今日每日任务「${dailyTaskStatus.taskName}」还需完成 ${dailyTaskStatus.remainingMinutes} 分钟`}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dailyTaskStatus.isMet ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        dailyTaskStatus.targetMinutes > 0
                          ? (dailyTaskStatus.todayMinutes / dailyTaskStatus.targetMinutes) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  已完成 {dailyTaskStatus.todayMinutes} / {dailyTaskStatus.targetMinutes} 分钟
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 计时器区域 */}
        <Card className="max-w-md mx-auto overflow-hidden border-0 shadow-lg shadow-blue-500/5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
          <CardContent className="relative pt-8 pb-8 text-center">
            {/* 任务选择 */}
            <div className="mb-6">
              <Select
                value={selectedTaskId}
                onValueChange={setSelectedTaskId}
                disabled={status !== 'idle'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择学习任务" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((task: StudyTask) => (
                    <SelectItem key={task.id} value={task.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: task.color }}
                        />
                        {task.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 计时器 */}
            <div className="relative">
              <div
                className={`text-6xl md:text-7xl font-mono font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 ${
                  status === 'running' ? 'animate-pulse' : ''
                }`}
              >
                {formatTime(displaySeconds)}
              </div>
              {status === 'running' && (
                <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-20 bg-gradient-to-r from-blue-500 to-indigo-500" />
              )}
            </div>

            {/* 状态文字 */}
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500">
              {status === 'running' && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              )}
              {statusText}
            </div>

            {/* 按钮区 */}
            <div className="flex justify-center gap-3 mt-8">
              {status === 'idle' && (
                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={!selectedTaskId}
                  className="px-8 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  <Play className="w-5 h-5 mr-1.5" />
                  开始学习
                </Button>
              )}
              {status === 'running' && (
                <>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={handlePause}
                    className="px-6"
                  >
                    <Pause className="w-5 h-5 mr-1.5" />
                    暂停
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleEnd}
                    className="px-6"
                  >
                    <Square className="w-5 h-5 mr-1.5" />
                    结束
                  </Button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <Button size="lg" onClick={handleResume} className="px-6 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40">
                    <Play className="w-5 h-5 mr-1.5" />
                    继续
                  </Button>
                  <Button size="lg" variant="destructive" onClick={handleEnd} className="px-6">
                    <Square className="w-5 h-5 mr-1.5" />
                    结束
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 今日统计 */}
        <div className="grid grid-cols-2 gap-4 mt-8 max-w-md mx-auto" data-ai-section-type="card-stat">
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">今日总学习时长</span>
                  <span className="mt-1 text-2xl font-bold text-slate-800 tracking-tight">
                    {todayMinutes} <span className="text-sm font-medium text-slate-500">分钟</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500">今日学习次数</span>
                  <span className="mt-1 text-2xl font-bold text-slate-800 tracking-tight">
                    {todaySessions} <span className="text-sm font-medium text-slate-500">次</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 待办设置对话框 */}
        <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-indigo-500" />
                设置今日待办
              </DialogTitle>
              <DialogDescription>
                开始学习前，先添加至少一项今日待办目标
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <Input
                  placeholder="输入待办内容，按回车添加"
                  value={newTodoContent}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewTodoContent(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddTodo();
                    }
                  }}
                  autoFocus
                />
                <Button onClick={handleAddTodo} disabled={todoLoading || !newTodoContent.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  添加
                </Button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {todoItems.length === 0 ? (
                  <div className="text-sm text-slate-400 py-6 text-center">
                    还没有待办项，先添加一个吧
                  </div>
                ) : (
                  todoItems.map((item: StudyTodoItem) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="truncate">{item.content}</span>
                      <span className="text-xs text-emerald-600">已添加</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <Button
                onClick={handleStartWithTodo}
                disabled={todoItems.length === 0}
              >
                开始学习
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 进度录入对话框 */}
        <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                结束学习
              </DialogTitle>
              <DialogDescription>
                {currentTask?.progressMode === 'todo'
                  ? `请选择本次完成的待办项（至少一项）`
                  : currentTask?.name
                    ? `「${currentTask.name}」本次学习完成了多少进度？`
                    : '本次学习完成了多少进度？'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
               {currentTask?.progressMode === 'todo' ? (
                 <div className="space-y-2">
                   <div className="text-sm font-medium text-slate-700">
                     选择完成的待办项
                     <span className="text-slate-400 font-normal ml-1">
                       （已选 {selectedTodoIds.length} 项）
                     </span>
                   </div>
                   {todoItems.length === 0 ? (
                     <div className="text-sm text-slate-400 py-4 text-center">
                       暂无今日待办项
                     </div>
                   ) : (
                     <div className="space-y-2">
                       {todoItems.map((item: StudyTodoItem) => {
                         const checked = selectedTodoIds.includes(item.id) || item.completed;
                         return (
                           <label
                             key={item.id}
                             className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                               item.completed
                                 ? 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'
                                 : checked
                                   ? 'border-blue-400 bg-blue-50/50'
                                   : 'border-slate-200 hover:border-slate-300'
                             }`}
                           >
                             <input
                               type="checkbox"
                               className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                               checked={checked}
                               disabled={item.completed}
                               onChange={() => {
                                 if (item.completed) return;
                                 setSelectedTodoIds((prev) =>
                                   prev.includes(item.id)
                                     ? prev.filter((id) => id !== item.id)
                                     : [...prev, item.id],
                                 );
                               }}
                             />
                             <span className={`text-sm flex-1 ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                               {item.content}
                             </span>
                             {item.completed && (
                               <span className="text-xs text-emerald-600">已完成</span>
                             )}
                           </label>
                         );
                       })}
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    完成数量
                    <span className="text-slate-400 font-normal ml-1">
                      （{currentTask?.progressUnit || '个'}）
                    </span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={
                      currentTask?.targetTotal
                        ? String(
                            Math.max(
                              0,
                              (currentTask.targetTotal as number) - currentTask.currentProgress,
                            ),
                          )
                        : undefined
                    }
                    step="1"
                    placeholder="例如：20"
                    value={progressAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setProgressAmount(e.target.value)
                    }
                    autoFocus
                  />
                  {currentTask?.targetTotal ? (
                    <p className="text-xs text-slate-400">
                      剩余进度：{(currentTask.targetTotal as number) - currentTask.currentProgress}{' '}
                      {currentTask.progressUnit}
                    </p>
                  ) : null}
                </div>
               )}
               {currentTask?.progressMode !== 'todo' && (
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-slate-700">
                     进度备注 <span className="text-slate-400 font-normal">（可选）</span>
                   </label>
                   <Input
                     placeholder="记录一下学习心得..."
                     value={progressNote}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                       setProgressNote(e.target.value)
                     }
                   />
                 </div>
               )}
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700">
                   学习备注 <span className="text-slate-400 font-normal">（可选）</span>
                 </label>
                 <Input
                   placeholder="这次学了什么，会显示在时间线上"
                   value={sessionNote}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                     setSessionNote(e.target.value)
                   }
                 />
               </div>
               {currentTask?.progressMode !== 'todo' && currentTask?.targetTotal ? (
                 <div className="rounded-lg bg-slate-50 p-3 text-sm">
                   <div className="text-slate-500">
                     当前进度：{currentTask.currentProgress} / {currentTask.targetTotal}{' '}
                     {currentTask.progressUnit}
                   </div>
                   <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                     <div
                       className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                       style={{
                         width: `${Math.min(
                           100,
                           Math.round(
                             (currentTask.currentProgress /
                               (currentTask.targetTotal as number)) *
                               100,
                           ),
                         )}%`,
                       }}
                     />
                   </div>
                 </div>
               ) : null}
             </div>
             <DialogFooter className="flex-row gap-2 sm:justify-between">
               <DialogClose asChild>
                 <Button variant="outline" disabled={submittingProgress}>
                   取消
                 </Button>
               </DialogClose>
               <div className="flex gap-2">
                 {currentTask?.progressMode !== 'todo' && (
                   <Button
                     variant="secondary"
                     disabled={submittingProgress}
                     onClick={() => handleConfirmEnd(false)}
                   >
                     跳过，直接结束
                   </Button>
                 )}
                 <Button
                   disabled={
                     submittingProgress ||
                     (currentTask?.progressMode === 'todo'
                       ? selectedTodoIds.length === 0
                       : !progressAmount)
                   }
                   onClick={() => handleConfirmEnd(currentTask?.progressMode !== 'todo')}
                 >
                   {submittingProgress
                     ? '提交中...'
                     : currentTask?.progressMode === 'todo'
                       ? '标记完成并结束'
                       : '记录进度并结束'}
                 </Button>
               </div>
             </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default TimerPage;
