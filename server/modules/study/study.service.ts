import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, gte, lt, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import { studyTask, studySession, studyProgressLog, studyTodoItem } from '@server/database/schema';
import type {
  StudyTask,
  StudySession,
  StudyProgressLog,
  StudyTodoItem,
  CreateTaskRequest,
  UpdateTaskRequest,
  AddProgressRequest,
  CreateTodoRequest,
  UpdateTodoRequest,
  TaskListResponse,
  SessionListResponse,
  ProgressLogListResponse,
  TodoListResponse,
  DashboardStats,
  DailyStats,
  StartSessionBlockedResponse,
  CompletedTaskItem,
  CompletedTasksResponse,
  TaskProgressMode,
} from '@shared/api.interface';

// Asia/Shanghai business date helpers
const MS_PER_DAY = 86_400_000;

function getShanghaiDate(date: Date = new Date()): string {
  // Format as YYYY-MM-DD in Shanghai timezone (UTC+8)
  const shanghaiMs = date.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(shanghaiMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayStartIso(dateStr: string): string {
  // dateStr is YYYY-MM-DD in Shanghai tz → convert to UTC ISO start of day
  const [year, month, day] = dateStr.split('-').map(Number);
  // Shanghai 00:00:00 = UTC previous day 16:00:00
  const d = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
  return d.toISOString();
}

function getNextDayStartIso(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000 + MS_PER_DAY);
  return d.toISOString();
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  // work in shanghai-date space
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function mapTask(row: typeof studyTask.$inferSelect): StudyTask {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? '#3370eb',
    targetTotal: row.targetTotal != null ? Number(row.targetTotal) : null,
    currentProgress: Number(row.currentProgress ?? 0),
    progressUnit: row.progressUnit ?? '个',
    progressMode: (row.progressMode ?? 'quantitative') as TaskProgressMode,
    status: row.status ?? 'active',
    isDailyTask: row.isDailyTask ?? false,
    dailyMinMinutes: row.dailyMinMinutes != null ? Number(row.dailyMinMinutes) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSession(
  row: typeof studySession.$inferSelect & { taskName?: string | null; taskColor?: string | null },
): StudySession {
  return {
    id: row.id,
    taskId: row.taskId,
    taskName: row.taskName ?? undefined,
    taskColor: row.taskColor ?? undefined,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime ? row.endTime.toISOString() : null,
    durationSeconds: row.durationSeconds ?? 0,
    note: row.note ?? null,
  };
}

function mapTodoItem(row: typeof studyTodoItem.$inferSelect): StudyTodoItem {
  return {
    id: row.id,
    taskId: row.taskId,
    content: row.content,
    completed: row.completed ?? false,
    todoDate: typeof row.todoDate === 'string' ? row.todoDate : String(row.todoDate),
  };
}

function mapProgressLog(
  row: typeof studyProgressLog.$inferSelect & { taskName?: string | null },
): StudyProgressLog {
  return {
    id: row.id,
    taskId: row.taskId,
    taskName: row.taskName ?? undefined,
    amount: Number(row.amount),
    note: row.note ?? null,
    // date type comes back as string from drizzle pg-core
    logDate: typeof row.logDate === 'string' ? row.logDate : String(row.logDate),
  };
}

@Injectable()
export class StudyService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  // ---------- Tasks ----------

  async getTasks(): Promise<TaskListResponse> {
    const rows = await this.db
      .select()
      .from(studyTask)
      .orderBy(desc(studyTask.createdAt));
    return { items: rows.map(mapTask) };
  }

  async createTask(dto: CreateTaskRequest, userId: string): Promise<StudyTask> {
    const rows = await this.db
      .insert(studyTask)
      .values({
        name: dto.name,
        description: dto.description,
        color: dto.color,
        progressMode: dto.progressMode ?? 'quantitative',
        targetTotal: dto.targetTotal != null ? String(dto.targetTotal) : undefined,
        progressUnit: dto.progressUnit,
        isDailyTask: dto.isDailyTask ?? false,
        dailyMinMinutes: dto.dailyMinMinutes,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return mapTask(rows[0]);
  }

  async updateTask(id: string, dto: UpdateTaskRequest, userId: string): Promise<StudyTask> {
    const patch: Partial<typeof studyTask.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.targetTotal !== undefined) {
      patch.targetTotal = dto.targetTotal != null ? String(dto.targetTotal) : null;
    }
    if (dto.currentProgress !== undefined) {
      patch.currentProgress = String(dto.currentProgress);
    }
    if (dto.progressUnit !== undefined) patch.progressUnit = dto.progressUnit;
    if (dto.progressMode !== undefined) patch.progressMode = dto.progressMode;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.isDailyTask !== undefined) patch.isDailyTask = dto.isDailyTask;
    if (dto.dailyMinMinutes !== undefined) patch.dailyMinMinutes = dto.dailyMinMinutes;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const rows = await this.db
      .update(studyTask)
      .set(patch)
      .where(eq(studyTask.id, id))
      .returning();
    if (rows.length === 0) throw new NotFoundException('任务不存在');
    return mapTask(rows[0]);
  }

  async deleteTask(id: string): Promise<void> {
    const rows = await this.db
      .delete(studyTask)
      .where(eq(studyTask.id, id))
      .returning({ id: studyTask.id });
    if (rows.length === 0) throw new NotFoundException('任务不存在');
  }

  // ---------- Sessions ----------

  async startSession(
    taskId: string,
    userId: string,
  ): Promise<{ session: StudySession } | { blocked: StartSessionBlockedResponse }> {
    const taskRows = await this.db
      .select()
      .from(studyTask)
      .where(eq(studyTask.id, taskId));
    if (taskRows.length === 0) throw new NotFoundException('任务不存在');
    const targetTask = taskRows[0];

    const isTargetDaily = targetTask.isDailyTask ?? false;

    if (!isTargetDaily) {
      const dailyTasks = await this.db
        .select()
        .from(studyTask)
        .where(and(
          eq(studyTask.isDailyTask, true),
          eq(studyTask.status, 'active'),
        ));

      if (dailyTasks.length > 0) {
        const today = getShanghaiDate();
        const todayStartIso = getDayStartIso(today);
        const todayEndIso = getNextDayStartIso(today);

        for (const dt of dailyTasks) {
          const minMinutes = dt.dailyMinMinutes ?? 0;
          if (minMinutes <= 0) continue;

          const durationRows = await this.db.select({
            totalSeconds: sql<number>`coalesce(sum(${studySession.durationSeconds}), 0)`,
          }).from(studySession).where(and(
            eq(studySession.taskId, dt.id),
            gte(studySession.startTime, new Date(todayStartIso)),
            lt(studySession.startTime, new Date(todayEndIso)),
          ));

          const totalSeconds = Number(durationRows[0]?.totalSeconds ?? 0);
          const todayMinutes = Math.floor(totalSeconds / 60);

          if (todayMinutes < minMinutes) {
            return {
              blocked: {
                blocked: true as const,
                reason: 'daily_task_minutes' as const,
                dailyTaskName: dt.name,
                dailyMinMinutes: minMinutes,
                todayMinutes,
                remainingMinutes: minMinutes - todayMinutes,
              },
            };
          }
        }
      }
    }

    const rows = await this.db
      .insert(studySession)
      .values({
        taskId,
        startTime: new Date(),
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return { session: mapSession(rows[0]) };
  }

  async endSession(
    sessionId: string,
    userId: string,
    note?: string,
    completedTodoIds?: string[],
  ): Promise<StudySession> {
    const existing = await this.db
      .select()
      .from(studySession)
      .where(eq(studySession.id, sessionId));
    if (existing.length === 0) throw new NotFoundException('学习时段不存在');
    const sessionRow = existing[0];

    const endTime = new Date();
    const startMs = sessionRow.startTime.getTime();
    const endMs = endTime.getTime();
    const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

    const patch: Partial<typeof studySession.$inferInsert> = {
      endTime,
      durationSeconds,
      updatedAt: new Date(),
      updatedBy: userId,
    };
    if (note !== undefined) patch.note = note;

    await this.db.transaction(async (tx) => {
      await tx
        .update(studySession)
        .set(patch)
        .where(eq(studySession.id, sessionId));

      if (completedTodoIds && completedTodoIds.length > 0) {
        await tx
          .update(studyTodoItem)
          .set({
            completed: true,
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(and(
            eq(studyTodoItem.taskId, sessionRow.taskId),
            inArray(studyTodoItem.id, completedTodoIds),
          ));
      }
    });

    const rows = await this.db
      .select()
      .from(studySession)
      .where(eq(studySession.id, sessionId));
    return mapSession(rows[0]);
  }

  async getActiveSession(): Promise<StudySession | null> {
    const rows = await this.db
      .select()
      .from(studySession)
      .where(isNull(studySession.endTime))
      .orderBy(desc(studySession.startTime))
      .limit(1);
    if (rows.length === 0) return null;
    return mapSession(rows[0]);
  }

  async getSessions(date?: string): Promise<SessionListResponse> {
    let startDate: Date;
    let endDate: Date;

    if (date) {
      startDate = new Date(getDayStartIso(date));
      endDate = new Date(getNextDayStartIso(date));
    } else {
      // last 7 days (today and 6 days before)
      const today = getShanghaiDate();
      const sevenDaysAgo = addDays(today, -6);
      startDate = new Date(getDayStartIso(sevenDaysAgo));
      endDate = new Date(getNextDayStartIso(today));
    }

    const rows = await this.db
      .select({
        id: studySession.id,
        taskId: studySession.taskId,
        startTime: studySession.startTime,
        endTime: studySession.endTime,
        durationSeconds: studySession.durationSeconds,
        note: studySession.note,
        taskName: studyTask.name,
        taskColor: studyTask.color,
      })
      .from(studySession)
      .leftJoin(studyTask, eq(studySession.taskId, studyTask.id))
      .where(and(gte(studySession.startTime, startDate), lt(studySession.startTime, endDate)))
      .orderBy(asc(studySession.startTime));

    return {
      items: rows.map((r) =>
        mapSession({
          id: r.id,
          taskId: r.taskId,
          startTime: r.startTime,
          endTime: r.endTime,
          durationSeconds: r.durationSeconds,
          note: r.note,
          taskName: r.taskName,
          taskColor: r.taskColor,
          createdAt: r.startTime,
          updatedAt: r.startTime,
          createdBy: '',
          updatedBy: '',
        }),
      ),
    };
  }

  // ---------- Todo Items ----------

  async getTodoItems(taskId?: string, date?: string): Promise<TodoListResponse> {
    const conditions = [];
    if (taskId) conditions.push(eq(studyTodoItem.taskId, taskId));
    if (date) conditions.push(eq(studyTodoItem.todoDate, date));

    const rows = conditions.length > 0
      ? await this.db
          .select()
          .from(studyTodoItem)
          .where(and(...conditions))
          .orderBy(asc(studyTodoItem.createdAt))
      : await this.db
          .select()
          .from(studyTodoItem)
          .orderBy(asc(studyTodoItem.createdAt));

    return { items: rows.map(mapTodoItem) };
  }

  async createTodo(dto: CreateTodoRequest, userId: string): Promise<StudyTodoItem> {
    const taskRows = await this.db
      .select({ id: studyTask.id })
      .from(studyTask)
      .where(eq(studyTask.id, dto.taskId));
    if (taskRows.length === 0) throw new NotFoundException('任务不存在');

    const rows = await this.db
      .insert(studyTodoItem)
      .values({
        taskId: dto.taskId,
        content: dto.content,
        todoDate: dto.todoDate ?? undefined,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return mapTodoItem(rows[0]);
  }

  async updateTodo(id: string, dto: UpdateTodoRequest, userId: string): Promise<StudyTodoItem> {
    const patch: Partial<typeof studyTodoItem.$inferInsert> = {};
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.completed !== undefined) patch.completed = dto.completed;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const rows = await this.db
      .update(studyTodoItem)
      .set(patch)
      .where(eq(studyTodoItem.id, id))
      .returning();
    if (rows.length === 0) throw new NotFoundException('待办事项不存在');
    return mapTodoItem(rows[0]);
  }

  async deleteTodo(id: string): Promise<void> {
    const rows = await this.db
      .delete(studyTodoItem)
      .where(eq(studyTodoItem.id, id))
      .returning({ id: studyTodoItem.id });
    if (rows.length === 0) throw new NotFoundException('待办事项不存在');
  }

  // ---------- Progress ----------

  async addProgress(dto: AddProgressRequest, userId: string): Promise<StudyProgressLog> {
    const taskRows = await this.db
      .select()
      .from(studyTask)
      .where(eq(studyTask.id, dto.taskId));
    if (taskRows.length === 0) throw new NotFoundException('任务不存在');

    const task = taskRows[0];
    const current = Number(task.currentProgress ?? 0);
    const target = task.targetTotal != null ? Number(task.targetTotal) : null;
    const amount = Number(dto.amount);

    if (amount <= 0) {
      throw new BadRequestException('完成数量必须大于 0');
    }

    if (target != null) {
      const remaining = target - current;
      if (amount > remaining + 0.001) {
        throw new BadRequestException(
          `本次完成量不能超过剩余进度 ${remaining} ${task.progressUnit ?? ''}`,
        );
      }
    }

    const amountStr = String(amount);

    const result = await this.db.transaction(async (tx) => {
      const logRows = await tx
        .insert(studyProgressLog)
        .values({
          taskId: dto.taskId,
          amount: amountStr,
          note: dto.note,
          logDate: dto.logDate ?? undefined,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const newProgress = current + amount;
      const taskPatch: Partial<typeof studyTask.$inferInsert> = {
        currentProgress: String(newProgress),
        updatedAt: new Date(),
        updatedBy: userId,
      };
      if (target != null && newProgress >= target - 0.001) {
        taskPatch.status = 'completed';
      }

      await tx
        .update(studyTask)
        .set(taskPatch)
        .where(eq(studyTask.id, dto.taskId));

      return logRows[0];
    });

    return mapProgressLog(result);
  }

  async getProgressLogs(taskId?: string): Promise<ProgressLogListResponse> {
    const rows = taskId
      ? await this.db
          .select({
            id: studyProgressLog.id,
            taskId: studyProgressLog.taskId,
            amount: studyProgressLog.amount,
            note: studyProgressLog.note,
            logDate: studyProgressLog.logDate,
            taskName: studyTask.name,
          })
          .from(studyProgressLog)
          .leftJoin(studyTask, eq(studyProgressLog.taskId, studyTask.id))
          .where(eq(studyProgressLog.taskId, taskId))
          .orderBy(desc(studyProgressLog.logDate), desc(studyProgressLog.createdAt))
      : await this.db
          .select({
            id: studyProgressLog.id,
            taskId: studyProgressLog.taskId,
            amount: studyProgressLog.amount,
            note: studyProgressLog.note,
            logDate: studyProgressLog.logDate,
            taskName: studyTask.name,
          })
          .from(studyProgressLog)
          .leftJoin(studyTask, eq(studyProgressLog.taskId, studyTask.id))
          .orderBy(desc(studyProgressLog.logDate), desc(studyProgressLog.createdAt));

    return {
      items: rows.map((r) =>
        mapProgressLog({
          id: r.id,
          taskId: r.taskId,
          amount: r.amount,
          note: r.note,
          logDate: r.logDate,
          taskName: r.taskName,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '',
          updatedBy: '',
        }),
      ),
    };
  }

  // ---------- Dashboard ----------

  async getDashboardStats(): Promise<DashboardStats> {
    const today = getShanghaiDate();
    const weekAgo = addDays(today, -6);
    const todayStartIso = getDayStartIso(today);
    const todayEndIso = getNextDayStartIso(today);
    const weekStartIso = getDayStartIso(weekAgo);
    const weekEndIso = getNextDayStartIso(today);

    // Summary stats with raw sql filter
    const summaryRows = await this.db.select({
      todayMinutes: sql<number>`
        coalesce(sum(${studySession.durationSeconds}) filter (
          where ${studySession.startTime} >= ${todayStartIso}
            and ${studySession.startTime} < ${todayEndIso}
            and ${studySession.endTime} is not null
        ), 0) / 60
      `.as('today_minutes'),
      todaySessions: sql<number>`
        count(*) filter (
          where ${studySession.startTime} >= ${todayStartIso}
            and ${studySession.startTime} < ${todayEndIso}
        )
      `.as('today_sessions'),
      weekMinutes: sql<number>`
        coalesce(sum(${studySession.durationSeconds}) filter (
          where ${studySession.startTime} >= ${weekStartIso}
            and ${studySession.startTime} < ${weekEndIso}
            and ${studySession.endTime} is not null
        ), 0) / 60
      `.as('week_minutes'),
    }).from(studySession);

    const activeTasksRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(studyTask)
      .where(eq(studyTask.status, 'active'));

    // Daily stats for last 7 days
    const dailyRows = await this.db.select({
      date: sql<string>`to_char((${studySession.startTime} at time zone 'Asia/Shanghai')::date, 'YYYY-MM-DD')`.as('date'),
      totalMinutes: sql<number>`coalesce(sum(${studySession.durationSeconds}) filter (where ${studySession.endTime} is not null), 0) / 60`.as('total_minutes'),
      sessions: sql<number>`count(*)`.as('sessions'),
    })
      .from(studySession)
       .where(and(
         gte(studySession.startTime, new Date(weekStartIso)),
         lt(studySession.startTime, new Date(weekEndIso)),
       ))
      .groupBy(sql`date`)
      .orderBy(asc(sql`date`));

    // Build complete 7-day array
    const dailyMap = new Map<string, { totalMinutes: number; sessions: number }>();
    for (const r of dailyRows) {
      dailyMap.set(r.date, {
        totalMinutes: Math.floor(Number(r.totalMinutes)),
        sessions: Number(r.sessions),
      });
    }

    const dailyStats: DailyStats[] = [];
    for (let i = -6; i <= 0; i += 1) {
      const d = addDays(today, i);
      const entry = dailyMap.get(d);
      dailyStats.push({
        date: d,
        totalMinutes: entry ? entry.totalMinutes : 0,
        sessions: entry ? entry.sessions : 0,
      });
    }

    const summary = summaryRows[0];

    return {
      todayMinutes: Math.floor(Number(summary.todayMinutes)),
      todaySessions: Number(summary.todaySessions),
      weekMinutes: Math.floor(Number(summary.weekMinutes)),
      activeTasks: Number(activeTasksRows[0]?.count ?? 0),
      dailyStats,
    };
  }

  // ---------- Completed Tasks (Achievement Wall) ----------

  async getCompletedTasks(): Promise<CompletedTasksResponse> {
    const completedRows = await this.db
      .select()
      .from(studyTask)
      .where(eq(studyTask.status, 'completed'))
      .orderBy(desc(studyTask.updatedAt));

    if (completedRows.length === 0) {
      return { items: [] };
    }

    const taskIds = completedRows.map((r) => r.id);
    const durationRows = await this.db
      .select({
        taskId: studySession.taskId,
        totalSeconds: sql<number>`coalesce(sum(${studySession.durationSeconds}), 0)`,
      })
      .from(studySession)
      .where(inArray(studySession.taskId, taskIds))
      .groupBy(studySession.taskId);

    const durationMap = new Map<string, number>();
    for (const r of durationRows) {
      durationMap.set(r.taskId, Math.floor(Number(r.totalSeconds) / 60));
    }

    const items: CompletedTaskItem[] = completedRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      color: row.color ?? '#3370eb',
      targetTotal: row.targetTotal != null ? Number(row.targetTotal) : null,
      finalProgress: Number(row.currentProgress ?? 0),
      progressUnit: row.progressUnit ?? '个',
      isDailyTask: row.isDailyTask ?? false,
      totalMinutes: durationMap.get(row.id) ?? 0,
      completedAt: row.updatedAt.toISOString(),
    }));

    return { items };
  }
}
