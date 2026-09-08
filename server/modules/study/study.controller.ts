import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { StudyService } from './study.service';
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
  CreateTodoRequest,
  UpdateTodoRequest,
  TaskListResponse,
  SessionListResponse,
  ProgressLogListResponse,
  TodoListResponse,
  DashboardStats,
  StartSessionBlockedResponse,
  CompletedTasksResponse,
} from '@shared/api.interface';

@Controller('api/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  // ---------- Tasks ----------

  @Get('tasks')
  async getTasks(): Promise<TaskListResponse> {
    return this.studyService.getTasks();
  }

  @NeedLogin()
  @Post('tasks')
  async createTask(
    @Req() req: Request,
    @Body() dto: CreateTaskRequest,
  ): Promise<StudyTask> {
    const { userId } = req.userContext;
    return this.studyService.createTask(dto, userId);
  }

  @NeedLogin()
  @Patch('tasks/:id')
  async updateTask(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTaskRequest,
  ): Promise<StudyTask> {
    const { userId } = req.userContext;
    return this.studyService.updateTask(id, dto, userId);
  }

  @NeedLogin()
  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@Param('id') id: string): Promise<void> {
    await this.studyService.deleteTask(id);
  }

  // ---------- Sessions ----------

  @NeedLogin()
  @Post('sessions/start')
  async startSession(
    @Req() req: Request,
    @Body() dto: StartSessionRequest,
  ): Promise<StudySession | StartSessionBlockedResponse> {
    const { userId } = req.userContext;
    const result = await this.studyService.startSession(dto.taskId, userId);
    if ('blocked' in result) {
      return result.blocked;
    }
    return result.session;
  }

  @NeedLogin()
  @Post('sessions/end')
  async endSession(
    @Req() req: Request,
    @Body() dto: EndSessionRequest,
  ): Promise<StudySession> {
    const { userId } = req.userContext;
    return this.studyService.endSession(dto.sessionId, userId, dto.note, dto.completedTodoIds);
  }

  @Get('sessions/active')
  async getActiveSession(): Promise<StudySession | null> {
    return this.studyService.getActiveSession();
  }

  @Get('sessions')
  async getSessions(@Query('date') date?: string): Promise<SessionListResponse> {
    return this.studyService.getSessions(date);
  }

  // ---------- Progress ----------

  @NeedLogin()
  @Post('progress')
  async addProgress(
    @Req() req: Request,
    @Body() dto: AddProgressRequest,
  ): Promise<StudyProgressLog> {
    const { userId } = req.userContext;
    return this.studyService.addProgress(dto, userId);
  }

  @Get('progress')
  async getProgress(
    @Query('taskId') taskId?: string,
  ): Promise<ProgressLogListResponse> {
    return this.studyService.getProgressLogs(taskId);
  }

  // ---------- Dashboard ----------

  @Get('dashboard')
  async getDashboard(): Promise<DashboardStats> {
    return this.studyService.getDashboardStats();
  }

  @Get('tasks/completed')
  async getCompletedTasks(): Promise<CompletedTasksResponse> {
    return this.studyService.getCompletedTasks();
  }

  // ---------- Todo Items ----------

  @NeedLogin()
  @Get('tasks/:id/todos')
  async getTodoItems(
    @Param('id') taskId: string,
    @Query('date') date?: string,
  ): Promise<TodoListResponse> {
    return this.studyService.getTodoItems(taskId, date);
  }

  @NeedLogin()
  @Post('tasks/:id/todos')
  async createTodo(
    @Req() req: Request,
    @Param('id') taskId: string,
    @Body() dto: Omit<CreateTodoRequest, 'taskId'>,
  ): Promise<StudyTodoItem> {
    const { userId } = req.userContext;
    return this.studyService.createTodo({ ...dto, taskId }, userId);
  }

  @NeedLogin()
  @Patch('todos/:id')
  async updateTodo(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTodoRequest,
  ): Promise<StudyTodoItem> {
    const { userId } = req.userContext;
    return this.studyService.updateTodo(id, dto, userId);
  }

  @NeedLogin()
  @Delete('todos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTodo(@Param('id') id: string): Promise<void> {
    await this.studyService.deleteTodo(id);
  }
}
