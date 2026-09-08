import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  StudyTask,
  StudySession,
  StudyProgressLog,
  StudyTodoItem,
  CreateTaskRequest,
  UpdateTaskRequest,
  StartSessionRequest,
  EndSessionRequest,
  AddProgressRequest,
  TaskListResponse,
  SessionListResponse,
  ProgressLogListResponse,
  TodoListResponse,
  DashboardStats,
  StartSessionBlockedResponse,
  CompletedTasksResponse,
} from '@shared/api.interface';

export async function getTasks(): Promise<TaskListResponse> {
  try {
    const res = await axiosForBackend.get('/api/study/tasks');
    return res.data;
  } catch (error) {
    logger.error('获取任务列表失败', error);
    throw error;
  }
}

export async function createTask(data: CreateTaskRequest): Promise<StudyTask> {
  try {
    const res = await axiosForBackend.post('/api/study/tasks', data);
    return res.data;
  } catch (error) {
    logger.error('创建任务失败', error);
    throw error;
  }
}

export async function updateTask(id: string, data: UpdateTaskRequest): Promise<StudyTask> {
  try {
    const res = await axiosForBackend.patch(`/api/study/tasks/${id}`, data);
    return res.data;
  } catch (error) {
    logger.error('更新任务失败', error);
    throw error;
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    await axiosForBackend.delete(`/api/study/tasks/${id}`);
  } catch (error) {
    logger.error('删除任务失败', error);
    throw error;
  }
}

export async function startSession(
  data: StartSessionRequest,
): Promise<StudySession | StartSessionBlockedResponse> {
  try {
    const res = await axiosForBackend.post('/api/study/sessions/start', data);
    return res.data;
  } catch (error) {
    logger.error('开始学习失败', error);
    throw error;
  }
}

export async function endSession(data: EndSessionRequest): Promise<StudySession> {
  try {
    const res = await axiosForBackend.post('/api/study/sessions/end', data);
    return res.data;
  } catch (error) {
    logger.error('结束学习失败', error);
    throw error;
  }
}

export async function getActiveSession(): Promise<StudySession | null> {
  try {
    const res = await axiosForBackend.get('/api/study/sessions/active');
    return res.data;
  } catch (error) {
    logger.error('获取进行中的学习失败', error);
    throw error;
  }
}

export async function getSessions(date?: string): Promise<SessionListResponse> {
  try {
    const url = date ? `/api/study/sessions?date=${date}` : '/api/study/sessions';
    const res = await axiosForBackend.get(url);
    return res.data;
  } catch (error) {
    logger.error('获取学习记录失败', error);
    throw error;
  }
}

export async function addProgress(data: AddProgressRequest): Promise<StudyProgressLog> {
  try {
    const res = await axiosForBackend.post('/api/study/progress', data);
    return res.data;
  } catch (error) {
    logger.error('添加进度失败', error);
    throw error;
  }
}

export async function getProgressLogs(taskId?: string): Promise<ProgressLogListResponse> {
  try {
    const url = taskId ? `/api/study/progress?taskId=${taskId}` : '/api/study/progress';
    const res = await axiosForBackend.get(url);
    return res.data;
  } catch (error) {
    logger.error('获取进度日志失败', error);
    throw error;
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await axiosForBackend.get('/api/study/dashboard');
    return res.data;
  } catch (error) {
    logger.error('获取仪表盘数据失败', error);
    throw error;
  }
}

export async function getCompletedTasks(): Promise<CompletedTasksResponse> {
  try {
    const res = await axiosForBackend.get('/api/study/tasks/completed');
    return res.data;
  } catch (error) {
    logger.error('获取已完成任务失败', error);
    throw error;
  }
}

export async function getTodoItems(
  taskId: string,
  date?: string,
): Promise<TodoListResponse> {
  try {
    const url = date
      ? `/api/study/tasks/${taskId}/todos?date=${date}`
      : `/api/study/tasks/${taskId}/todos`;
    const res = await axiosForBackend.get(url);
    return res.data;
  } catch (error) {
    logger.error('获取待办列表失败', error);
    throw error;
  }
}

export async function createTodo(
  taskId: string,
  content: string,
  todoDate?: string,
): Promise<StudyTodoItem> {
  try {
    const res = await axiosForBackend.post(`/api/study/tasks/${taskId}/todos`, {
      content,
      todoDate,
    });
    return res.data;
  } catch (error) {
    logger.error('创建待办失败', error);
    throw error;
  }
}

export async function updateTodo(
  id: string,
  data: { content?: string; completed?: boolean },
): Promise<StudyTodoItem> {
  try {
    const res = await axiosForBackend.patch(`/api/study/todos/${id}`, data);
    return res.data;
  } catch (error) {
    logger.error('更新待办失败', error);
    throw error;
  }
}

export async function deleteTodo(id: string): Promise<void> {
  try {
    await axiosForBackend.delete(`/api/study/todos/${id}`);
  } catch (error) {
    logger.error('删除待办失败', error);
    throw error;
  }
}
