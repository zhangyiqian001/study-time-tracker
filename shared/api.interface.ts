export type TaskProgressMode = 'quantitative' | 'todo';

export interface StudyTask {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetTotal: number | null;
  currentProgress: number;
  progressUnit: string;
  progressMode: TaskProgressMode;
  status: string;
  isDailyTask: boolean;
  dailyMinMinutes: number | null;
  createdAt: string;
}

export interface StudySession {
  id: string;
  taskId: string;
  taskName?: string;
  taskColor?: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  note: string | null;
}

export interface StudyProgressLog {
  id: string;
  taskId: string;
  taskName?: string;
  amount: number;
  note: string | null;
  logDate: string;
}

export interface StudyTodoItem {
  id: string;
  taskId: string;
  content: string;
  completed: boolean;
  todoDate: string;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  color?: string;
  progressMode?: TaskProgressMode;
  targetTotal?: number;
  progressUnit?: string;
  isDailyTask?: boolean;
  dailyMinMinutes?: number;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  color?: string;
  progressMode?: TaskProgressMode;
  targetTotal?: number;
  currentProgress?: number;
  progressUnit?: string;
  status?: string;
  isDailyTask?: boolean;
  dailyMinMinutes?: number;
}

export interface StartSessionRequest {
  taskId: string;
}

export interface EndSessionRequest {
  sessionId: string;
  note?: string;
  completedTodoIds?: string[];
}

export interface AddProgressRequest {
  taskId: string;
  amount: number;
  note?: string;
  logDate?: string;
}

export interface CreateTodoRequest {
  taskId: string;
  content: string;
  todoDate?: string;
}

export interface UpdateTodoRequest {
  content?: string;
  completed?: boolean;
}

export interface TaskListResponse {
  items: StudyTask[];
}

export interface SessionListResponse {
  items: StudySession[];
}

export interface StartSessionResponse {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
}

export interface StartSessionBlockedResponse {
  blocked: true;
  reason: 'daily_task_minutes' | 'no_todo_items';
  dailyTaskName?: string;
  dailyMinMinutes?: number;
  todayMinutes?: number;
  remainingMinutes?: number;
  todoTaskName?: string;
}

export interface ProgressLogListResponse {
  items: StudyProgressLog[];
}

export interface TodoListResponse {
  items: StudyTodoItem[];
}

export interface DailyStats {
  date: string;
  totalMinutes: number;
  sessions: number;
}

export interface DashboardStats {
  todayMinutes: number;
  todaySessions: number;
  weekMinutes: number;
  activeTasks: number;
  dailyStats: DailyStats[];
}

export interface CompletedTaskItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  targetTotal: number | null;
  finalProgress: number;
  progressUnit: string;
  isDailyTask: boolean;
  totalMinutes: number;
  completedAt: string;
}

export interface CompletedTasksResponse {
  items: CompletedTaskItem[];
}
