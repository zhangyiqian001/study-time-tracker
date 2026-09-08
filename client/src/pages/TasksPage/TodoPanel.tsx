import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { studyApi } from '@client/src/api';
import type { StudyTodoItem } from '@shared/api.interface';

import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

interface TodoPanelProps {
  taskId: string;
  initialDate?: string;
  onChanged?: () => void;
}

const getTodayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const TodoPanel = ({ taskId, initialDate, onChanged }: TodoPanelProps) => {
  const [todos, setTodos] = useState<StudyTodoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [todoDate, setTodoDate] = useState<string>(initialDate ?? getTodayIso());
  const [newContent, setNewContent] = useState<string>('');
  const [adding, setAdding] = useState<boolean>(false);

  const fetchTodos = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await studyApi.getTodoItems(taskId, todoDate);
      setTodos(res.items);
    } catch (error) {
      logger.error('获取待办列表失败', error);
      toast.error('获取待办列表失败');
    } finally {
      setLoading(false);
    }
  }, [taskId, todoDate]);

  useEffect(() => {
    void fetchTodos();
  }, [fetchTodos]);

  const handleAddTodo = async (): Promise<void> => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      await studyApi.createTodo(taskId, newContent.trim(), todoDate);
      setNewContent('');
      toast.success('待办添加成功');
      void fetchTodos();
      onChanged?.();
    } catch (error) {
      logger.error('添加待办失败', error);
      toast.error('添加待办失败');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleTodo = async (todo: StudyTodoItem): Promise<void> => {
    try {
      await studyApi.updateTodo(todo.id, { completed: !todo.completed });
      void fetchTodos();
      onChanged?.();
    } catch (error) {
      logger.error('更新待办失败', error);
      toast.error('更新待办失败');
    }
  };

  const handleDeleteTodo = async (id: string): Promise<void> => {
    try {
      await studyApi.deleteTodo(id);
      toast.success('待办已删除');
      void fetchTodos();
      onChanged?.();
    } catch (error) {
      logger.error('删除待办失败', error);
      toast.error('删除待办失败');
    }
  };

  const completedCount = todos.filter((t: StudyTodoItem) => t.completed).length;
  const totalCount = todos.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={todoDate}
          onChange={(e): void => setTodoDate(e.target.value)}
          className="flex-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="添加待办事项..."
          value={newContent}
          onChange={(e): void => setNewContent(e.target.value)}
          onKeyDown={(e): void => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAddTodo();
            }
          }}
        />
        <Button
          onClick={(): void => {
            void handleAddTodo();
          }}
          disabled={adding || !newContent.trim()}
          size="sm"
        >
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {loading ? (
          <div className="py-4 text-center text-sm text-slate-400">加载中...</div>
        ) : todos.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">暂无待办事项</div>
        ) : (
          todos.map((todo: StudyTodoItem) => (
            <div
              key={todo.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50"
            >
              <button
                type="button"
                onClick={(): void => {
                  void handleToggleTodo(todo);
                }}
                className="flex-shrink-0 text-slate-400 hover:text-blue-500"
              >
                {todo.completed ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <Circle className="size-4" />
                )}
              </button>
              <span
                className={`flex-1 text-sm ${
                  todo.completed
                    ? 'text-slate-400 line-through'
                    : 'text-slate-700'
                }`}
              >
                {todo.content}
              </span>
              <button
                type="button"
                onClick={(): void => {
                  void handleDeleteTodo(todo.id);
                }}
                className="flex-shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                onMouseEnter={(e): void => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e): void => {
                  e.currentTarget.style.opacity = '0';
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
        已完成 {completedCount} / 共 {totalCount} 项
      </div>
    </div>
  );
};
