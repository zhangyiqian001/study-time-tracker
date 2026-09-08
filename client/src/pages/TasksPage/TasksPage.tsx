import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Target,
} from 'lucide-react';

import { studyApi } from '@client/src/api';
import type {
  StudyTask,
  StudyTodoItem,
  CreateTaskRequest,
  AddProgressRequest,
  TaskProgressMode,
} from '@shared/api.interface';
import { TodoPanel } from './TodoPanel';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardFooter } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Switch } from '@client/src/components/ui/switch';
const PRESET_COLORS: string[] = [
  '#3370eb',
  '#1bcebf',
  '#ffc60a',
  '#ff6b6b',
  '#9b59b6',
  '#2ecc71',
];

const taskFormSchema = z.object({
  name: z.string().min(1, '任务名称不能为空'),
  description: z.string().optional(),
  color: z.string().min(1, '请选择颜色'),
  progressMode: z.enum(['quantitative', 'todo']).default('quantitative'),
  targetTotal: z.coerce.number().optional(),
  progressUnit: z.string().min(1, '请输入进度单位'),
  isDailyTask: z.boolean().default(false),
  dailyMinMinutes: z.coerce.number().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const progressFormSchema = z.object({
  amount: z.coerce.number().min(0.01, '数量必须大于 0'),
  note: z.string().optional(),
  logDate: z.string().min(1, '请选择日期'),
});

type ProgressFormData = z.infer<typeof progressFormSchema>;

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return '进行中';
    case 'completed':
      return '已完成';
    case 'paused':
      return '已暂停';
    default:
      return status;
  }
};

const getStatusVariant = (
  status: string,
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'active':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'paused':
      return 'outline';
    default:
      return 'default';
  }
};

const getTodayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TasksPage = () => {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [editTask, setEditTask] = useState<StudyTask | null>(null);
  const [progressTask, setProgressTask] = useState<StudyTask | null>(null);
  const [deleteTask, setDeleteTask] = useState<StudyTask | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [todoMap, setTodoMap] = useState<Record<string, StudyTodoItem[]>>({});

  const fetchTasks = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await studyApi.getTasks();
      setTasks(res.items);
    } catch (error) {
      logger.error('获取任务列表失败', error);
      toast.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const createForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: PRESET_COLORS[0] ?? '',
      progressMode: 'quantitative',
      targetTotal: undefined,
      progressUnit: '个',
      isDailyTask: false,
      dailyMinMinutes: undefined,
    },
  });

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: PRESET_COLORS[0] ?? '',
      progressMode: 'quantitative',
      targetTotal: undefined,
      progressUnit: '个',
      isDailyTask: false,
      dailyMinMinutes: undefined,
    },
  });

  const progressForm = useForm<ProgressFormData>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      amount: 1,
      note: '',
      logDate: getTodayIso(),
    },
  });

  const handleOpenCreate = (): void => {
    createForm.reset({
      name: '',
      description: '',
      color: PRESET_COLORS[0] ?? '',
      progressMode: 'quantitative',
      targetTotal: undefined,
      progressUnit: '个',
      isDailyTask: false,
      dailyMinMinutes: undefined,
    });
    setCreateOpen(true);
  };

  const handleCreateSubmit = createForm.handleSubmit(
    async (data: TaskFormData): Promise<void> => {
      setSubmitting(true);
      try {
        const request: CreateTaskRequest = {
          name: data.name,
          description: data.description || undefined,
          color: data.color,
          progressMode: data.progressMode,
          targetTotal: data.progressMode === 'quantitative' ? data.targetTotal : undefined,
          progressUnit: data.progressMode === 'quantitative' ? data.progressUnit : '项',
          isDailyTask: data.isDailyTask,
          dailyMinMinutes: data.isDailyTask ? data.dailyMinMinutes : undefined,
        };
        await studyApi.createTask(request);
        toast.success('任务创建成功');
        setCreateOpen(false);
        void fetchTasks();
      } catch (error) {
        logger.error('创建任务失败', error);
        toast.error('创建任务失败');
      } finally {
        setSubmitting(false);
      }
    },
  );

  const handleOpenEdit = (task: StudyTask): void => {
    editForm.reset({
      name: task.name,
      description: task.description ?? '',
      color: task.color,
      progressMode: task.progressMode ?? 'quantitative',
      targetTotal: task.targetTotal ?? undefined,
      progressUnit: task.progressUnit,
      isDailyTask: task.isDailyTask ?? false,
      dailyMinMinutes: task.dailyMinMinutes ?? undefined,
    });
    setEditTask(task);
  };

  const handleEditSubmit = editForm.handleSubmit(
    async (data: TaskFormData): Promise<void> => {
      if (!editTask) return;
      setSubmitting(true);
      try {
        await studyApi.updateTask(editTask.id, {
          name: data.name,
          description: data.description || undefined,
          color: data.color,
          progressMode: data.progressMode,
          targetTotal: data.progressMode === 'quantitative' ? data.targetTotal : undefined,
          progressUnit:
            data.progressMode === 'quantitative' ? data.progressUnit : '项',
          isDailyTask: data.isDailyTask,
          dailyMinMinutes: data.isDailyTask ? data.dailyMinMinutes : undefined,
        });
        toast.success('任务更新成功');
        setEditTask(null);
        void fetchTasks();
      } catch (error) {
        logger.error('更新任务失败', error);
        toast.error('更新任务失败');
      } finally {
        setSubmitting(false);
      }
    },
  );

  const handleOpenProgress = (task: StudyTask): void => {
    progressForm.reset({
      amount: 1,
      note: '',
      logDate: getTodayIso(),
    });
    setProgressTask(task);
  };

  const handleProgressSubmit = progressForm.handleSubmit(
    async (data: ProgressFormData): Promise<void> => {
      if (!progressTask) return;
      setSubmitting(true);
      try {
        const request: AddProgressRequest = {
          taskId: progressTask.id,
          amount: data.amount,
          note: data.note || undefined,
          logDate: data.logDate,
        };
        await studyApi.addProgress(request);
        toast.success('进度记录成功');
        setProgressTask(null);
        void fetchTasks();
      } catch (error) {
        logger.error('记录进度失败', error);
        toast.error('记录进度失败');
      } finally {
        setSubmitting(false);
      }
    },
  );

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTask) return;
    setSubmitting(true);
    try {
      await studyApi.deleteTask(deleteTask.id);
      toast.success('任务已删除');
      setDeleteTask(null);
      void fetchTasks();
    } catch (error) {
      logger.error('删除任务失败', error);
      toast.error('删除任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getModeLabel = (mode: TaskProgressMode): string => {
    return mode === 'quantitative' ? '定量目标' : 'ToDo 清单';
  };

  const renderProgress = (task: StudyTask) => {
    if (task.progressMode === 'todo') {
      const todos = todoMap[task.id] ?? [];
      const completedCount = todos.filter(
        (t: StudyTodoItem) => t.completed,
      ).length;
      const totalCount = todos.length;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">今日待办</span>
            <span className="font-medium text-slate-700">
              已完成 {completedCount} / 共 {totalCount} 项
            </span>
          </div>
          <div className="space-y-1">
            {todos.slice(0, 3).map((todo: StudyTodoItem) => (
              <div
                key={todo.id}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2
                  className={`size-3.5 flex-shrink-0 ${
                    todo.completed ? 'text-emerald-500' : 'text-slate-300'
                  }`}
                />
                <span
                  className={`truncate ${
                    todo.completed
                      ? 'text-slate-400 line-through'
                      : 'text-slate-600'
                  }`}
                >
                  {todo.content}
                </span>
              </div>
            ))}
            {todos.length > 3 && (
              <div className="text-xs text-slate-400">
                还有 {todos.length - 3} 项...
              </div>
            )}
            {todos.length === 0 && (
              <div className="text-xs text-slate-400">暂无待办</div>
            )}
          </div>
        </div>
      );
    }

    // quantitative mode
    const unit = task.progressUnit || '个';
    if (task.targetTotal && task.targetTotal > 0) {
      const percent = Math.min(
        100,
        Math.round((task.currentProgress / task.targetTotal) * 100),
      );
      return (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">进度</span>
            <span className="font-medium text-slate-700">
              {task.currentProgress} / {task.targetTotal} {unit}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${task.color}, ${task.color}dd)`,
              }}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">已完成</span>
        <span className="font-medium text-slate-700">
          {task.currentProgress} {unit}
        </span>
      </div>
    );
  };

  const loadTodosForTask = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        const res = await studyApi.getTodoItems(taskId, getTodayIso());
        setTodoMap((prev) => ({ ...prev, [taskId]: res.items }));
      } catch (error) {
        logger.error('加载待办失败', error);
      }
    },
    [],
  );

  useEffect(() => {
    const todoTasks = tasks.filter(
      (t: StudyTask) => t.progressMode === 'todo',
    );
    for (const task of todoTasks) {
      if (!(task.id in todoMap)) {
        void loadTodosForTask(task.id);
      }
    }
  }, [tasks, todoMap, loadTodosForTask]);

  const handleToggleExpand = (taskId: string): void => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      void loadTodosForTask(taskId);
    }
  };

  const todayDisplay = useMemo(() => {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const m = now.getMonth() + 1;
    const d = now.getDate();
    return `${m}月${d}日 · ${weekdays[now.getDay()]}`;
  }, []);

  const activeCount = tasks.filter((t: StudyTask) => t.status === 'active').length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">任务管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todayDisplay} · 共 {tasks.length} 个任务，{activeCount} 个进行中
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="shadow-sm">
          <Plus className="mr-2 size-4" />
          新建任务
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white py-16">
          <CheckCircle2 className="mb-3 size-10 text-slate-300" />
          <p className="text-slate-500">暂无任务</p>
          <p className="mb-4 text-sm text-slate-400">点击上方按钮创建第一个任务</p>
          <Button onClick={handleOpenCreate} variant="secondary">
            <Plus className="mr-2 size-4" />
            新建任务
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
           {tasks.map((task: StudyTask) => (
             <Card
               key={task.id}
               className="flex flex-col overflow-hidden border border-slate-200 bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
             >
               <div
                 className="h-1.5 w-full"
                 style={{ backgroundColor: task.color }}
               />
                 <div className="flex items-start justify-between p-5 pb-3">
                   <h3 className="text-base font-semibold text-slate-800 leading-snug">
                     {task.name}
                   </h3>
                   <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 ml-2">
                     {task.isDailyTask && (
                       <Badge
                         variant="outline"
                         className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
                       >
                         <CalendarClock className="mr-1 size-3" />
                         每日
                       </Badge>
                     )}
                     <Badge
                       variant="outline"
                       className={
                         task.progressMode === 'todo'
                           ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50'
                           : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50'
                       }
                     >
                       {task.progressMode === 'todo' ? (
                         <ListTodo className="mr-1 size-3" />
                       ) : (
                         <Target className="mr-1 size-3" />
                       )}
                       {getModeLabel(task.progressMode)}
                     </Badge>
                     <Badge
                       variant={getStatusVariant(task.status)}
                     >
                       {getStatusLabel(task.status)}
                     </Badge>
                   </div>
                 </div>
                <CardContent className="flex-1 px-5 pt-0 pb-3">
                  {task.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-slate-500 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                  {renderProgress(task)}
                </CardContent>
                {task.progressMode === 'todo' && expandedTaskId === task.id && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <TodoPanel
                      taskId={task.id}
                      initialDate={getTodayIso()}
                      onChanged={(): void => {
                        void loadTodosForTask(task.id);
                      }}
                    />
                  </div>
                )}
                <CardFooter className="flex flex-wrap gap-2 px-5 pb-4 pt-0">
                 <Button
                   variant="outline"
                   size="sm"
                   className="flex-1"
                   onClick={() => handleOpenEdit(task)}
                 >
                   <Pencil className="mr-1 size-3" />
                   编辑
                 </Button>
                 {task.progressMode === 'quantitative' ? (
                   <Button
                     variant="outline"
                     size="sm"
                     className="flex-1"
                     onClick={() => handleOpenProgress(task)}
                   >
                     <TrendingUp className="mr-1 size-3" />
                     记录进度
                   </Button>
                 ) : (
                   <Button
                     variant="outline"
                     size="sm"
                     className="flex-1"
                     onClick={() => handleToggleExpand(task.id)}
                   >
                     {expandedTaskId === task.id ? (
                       <>
                         <ChevronUp className="mr-1 size-3" />
                         收起
                       </>
                     ) : (
                       <>
                         <ListTodo className="mr-1 size-3" />
                         待办清单
                       </>
                     )}
                   </Button>
                 )}
                 <Button
                   variant="ghost"
                   size="sm"
                   className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                   onClick={() => setDeleteTask(task)}
                 >
                   <Trash2 className="size-4" />
                 </Button>
               </CardFooter>
             </Card>
           ))}
        </div>
      )}

      {/* 新建任务 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>
              创建一个新的学习任务，设置目标和进度单位。
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={(e): void => {
                void handleCreateSubmit(e);
              }}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      任务名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="请输入任务名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="任务描述（可选）"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>颜色</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color: string) => (
                          <button
                            key={color}
                            type="button"
                            className={`size-8 rounded-full border-2 transition-all ${
                              field.value === color
                                ? 'border-slate-900 scale-110'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={(): void => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                 control={createForm.control}
                 name="progressMode"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>进度模式</FormLabel>
                     <FormControl>
                       <div className="flex gap-2">
                         <button
                           type="button"
                           onClick={(): void => field.onChange('quantitative')}
                           className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                             field.value === 'quantitative'
                               ? 'border-blue-500 bg-blue-50 text-blue-700'
                               : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                           }`}
                         >
                           <Target className="mx-auto mb-1 size-4" />
                           定量目标
                         </button>
                         <button
                           type="button"
                           onClick={(): void => field.onChange('todo')}
                           className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                             field.value === 'todo'
                               ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                               : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                           }`}
                         >
                           <ListTodo className="mx-auto mb-1 size-4" />
                           ToDo 清单
                         </button>
                       </div>
                     </FormControl>
                     <p className="text-xs text-slate-400">
                       {field.value === 'quantitative'
                         ? '设置总目标数量，每次学习累加进度（如看书 300 页）'
                         : '每天添加待办事项，逐项勾选完成'}
                     </p>
                     <FormMessage />
                   </FormItem>
                 )}
               />
               {createForm.watch('progressMode') === 'quantitative' && (
                 <div className="flex flex-wrap gap-4">
                   <FormField
                     control={createForm.control}
                     name="targetTotal"
                     render={({ field }) => (
                       <FormItem className="flex-1">
                         <FormLabel>目标总数</FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             placeholder="可选，如 100"
                             value={field.value ?? ''}
                             onChange={(e): void => {
                               const val = e.target.value;
                               field.onChange(val === '' ? undefined : Number(val));
                             }}
                             onBlur={field.onBlur}
                             name={field.name}
                             ref={field.ref}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                    <FormField
                      control={createForm.control}
                      name="progressUnit"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>进度单位</FormLabel>
                          <FormControl>
                            <Input placeholder="个" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
               )}

               <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                 <FormField
                   control={createForm.control}
                   name="isDailyTask"
                   render={({ field }) => (
                     <FormItem className="flex flex-row items-center justify-between space-y-0">
                       <div>
                         <FormLabel className="text-sm font-medium text-slate-700">
                           设为每日任务
                         </FormLabel>
                         <p className="text-xs text-slate-500">
                           每天需要完成最低学习时长，未达标前其他任务无法开始
                         </p>
                       </div>
                       <FormControl>
                         <Switch
                           checked={field.value}
                           onCheckedChange={field.onChange}
                         />
                       </FormControl>
                     </FormItem>
                   )}
                 />
                 {createForm.watch('isDailyTask') && (
                   <FormField
                     control={createForm.control}
                     name="dailyMinMinutes"
                     render={({ field }) => (
                       <FormItem className="mt-4">
                         <FormLabel>
                           每日最低学习时长（分钟）{' '}
                           <span className="text-destructive">*</span>
                         </FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             min={1}
                             placeholder="如 120"
                             value={field.value ?? ''}
                             onChange={(e): void => {
                               const val = e.target.value;
                               field.onChange(val === '' ? undefined : Number(val));
                             }}
                             onBlur={field.onBlur}
                             name={field.name}
                             ref={field.ref}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 )}
               </div>

               <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={(): void => setCreateOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 编辑任务 Dialog */}
      <Dialog
        open={editTask !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setEditTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
            <DialogDescription>
              修改任务的基本信息和目标设置。
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={(e): void => {
                void handleEditSubmit(e);
              }}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      任务名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="请输入任务名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="任务描述（可选）"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>颜色</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color: string) => (
                          <button
                            key={color}
                            type="button"
                            className={`size-8 rounded-full border-2 transition-all ${
                              field.value === color
                                ? 'border-slate-900 scale-110'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={(): void => field.onChange(color)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                 control={editForm.control}
                 name="progressMode"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>进度模式</FormLabel>
                     <FormControl>
                       <div className="flex gap-2">
                         <button
                           type="button"
                           onClick={(): void => field.onChange('quantitative')}
                           className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                             field.value === 'quantitative'
                               ? 'border-blue-500 bg-blue-50 text-blue-700'
                               : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                           }`}
                         >
                           <Target className="mx-auto mb-1 size-4" />
                           定量目标
                         </button>
                         <button
                           type="button"
                           onClick={(): void => field.onChange('todo')}
                           className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                             field.value === 'todo'
                               ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                               : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                           }`}
                         >
                           <ListTodo className="mx-auto mb-1 size-4" />
                           ToDo 清单
                         </button>
                       </div>
                     </FormControl>
                     <p className="text-xs text-slate-400">
                       {field.value === 'quantitative'
                         ? '设置总目标数量，每次学习累加进度（如看书 300 页）'
                         : '每天添加待办事项，逐项勾选完成'}
                     </p>
                     <FormMessage />
                   </FormItem>
                 )}
               />
               {editForm.watch('progressMode') === 'quantitative' && (
                 <div className="flex flex-wrap gap-4">
                   <FormField
                     control={editForm.control}
                     name="targetTotal"
                     render={({ field }) => (
                       <FormItem className="flex-1">
                         <FormLabel>目标总数</FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             placeholder="可选，如 100"
                             value={field.value ?? ''}
                             onChange={(e): void => {
                               const val = e.target.value;
                               field.onChange(val === '' ? undefined : Number(val));
                             }}
                             onBlur={field.onBlur}
                             name={field.name}
                             ref={field.ref}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                    <FormField
                      control={editForm.control}
                      name="progressUnit"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>进度单位</FormLabel>
                          <FormControl>
                            <Input placeholder="个" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                 </div>
               )}

               <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <FormField
                    control={editForm.control}
                    name="isDailyTask"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            设为每日任务
                          </FormLabel>
                          <p className="text-xs text-slate-500">
                            每天需要完成最低学习时长，未达标前其他任务无法开始
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {editForm.watch('isDailyTask') && (
                   <FormField
                     control={editForm.control}
                     name="dailyMinMinutes"
                     render={({ field }) => (
                       <FormItem className="mt-4">
                         <FormLabel>
                           每日最低学习时长（分钟）{' '}
                           <span className="text-destructive">*</span>
                         </FormLabel>
                         <FormControl>
                           <Input
                             type="number"
                             min={1}
                             placeholder="如 120"
                             value={field.value ?? ''}
                             onChange={(e): void => {
                               const val = e.target.value;
                               field.onChange(val === '' ? undefined : Number(val));
                             }}
                             onBlur={field.onBlur}
                             name={field.name}
                             ref={field.ref}
                           />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                 )}
               </div>

               <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={(): void => setEditTask(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '保存中...' : '保存'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 记录进度 Dialog */}
      <Dialog
        open={progressTask !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setProgressTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录进度</DialogTitle>
            <DialogDescription>
              {progressTask
                ? `为「${progressTask.name}」记录本次完成的进度。`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <Form {...progressForm}>
            <form
              onSubmit={(e): void => {
                void handleProgressSubmit(e);
              }}
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-4">
                <FormField
                  control={progressForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>
                        本次完成数量{' '}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={progressForm.control}
                  name="logDate"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={progressForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="学习笔记或备注（可选）"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={(): void => setProgressTask(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '记录中...' : '记录'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 AlertDialog */}
      <AlertDialog
        open={deleteTask !== null}
        onOpenChange={(open: boolean): void => {
          if (!open) setDeleteTask(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除任务「{deleteTask?.name}」及其相关进度记录，删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(): void => {
                void handleConfirmDelete();
              }}
            >
              {submitting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TasksPage;
