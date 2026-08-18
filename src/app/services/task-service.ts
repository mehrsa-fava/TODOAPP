import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map, forkJoin } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task, TaskStatus, AddTaskInput, UpdateTaskInput } from '../model/task';
import type { TaskApiResponse, CreateTaskDto, UpdateTaskDto } from '../model/task-api';
import { apiToTask, toCreateDto, toUpdateDto } from './task-api.mappers';
import { getApiErrorMessage } from '../utils/api-error.util';

const TASK_BASE = `${environment.api}/Task`;

function parseTaskId(id: string): number | null {
  const num = parseInt(id, 10);
  return Number.isNaN(num) ? null : num;
}

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly tasksSignal = signal<Task[]>([]);
  private readonly tasksByProjectSignal = signal<Record<number, Task[]>>({});
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  readonly tasks = this.tasksSignal.asReadonly();
  readonly tasksByProject = this.tasksByProjectSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly completedCount = computed(
    () => this.tasksSignal().filter((t) => t.status === 'Done').length,
  );
  readonly activeCount = computed(
    () => this.tasksSignal().filter((t) => t.status !== 'Done').length,
  );

  loadTasks(): Observable<Task[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    return this.http.get<TaskApiResponse[]>(`${TASK_BASE}/GetAllTasks`).pipe(
      tap(() => this.loadingSignal.set(false)),
      catchError((err) => {
        this.loadingSignal.set(false);
        this.errorSignal.set(getApiErrorMessage(err, 'Failed to load tasks'));
        return of([]);
      }),
      map((list) => (list ?? []).map(apiToTask)),
      tap((tasks) => {
        this.tasksSignal.set(tasks);
        this.errorSignal.set(null);
      }),
    );
  }

  /** Loads tasks for a single project (backend: GetAllTasksByProjectId). */
  loadTasksByProjectId(projectId: number): Observable<Task[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    return this.http
      .get<TaskApiResponse[] | TaskApiResponse>(`${TASK_BASE}/GetAllTasksByProjectId`, {
        params: { projectId },
      })
      .pipe(
        tap(() => this.loadingSignal.set(false)),
        catchError((err) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(getApiErrorMessage(err, 'Failed to load tasks'));
          return of([]);
        }),
        map((body) => {
          const list = Array.isArray(body) ? body : body ? [body as TaskApiResponse] : [];
          return list.map(apiToTask);
        }),
        tap((tasks) => {
          this.tasksSignal.set(tasks);
          this.tasksByProjectSignal.update((map) => ({ ...map, [projectId]: tasks }));
          this.errorSignal.set(null);
        }),
      );
  }

  /** Loads tasks into the per-project cache without replacing the active task list. */
  loadProjectTasksCache(projectId: number): Observable<Task[]> {
    return this.http
      .get<TaskApiResponse[] | TaskApiResponse>(`${TASK_BASE}/GetAllTasksByProjectId`, {
        params: { projectId },
      })
      .pipe(
        catchError(() => of([])),
        map((body) => {
          const list = Array.isArray(body) ? body : body ? [body as TaskApiResponse] : [];
          return list.map(apiToTask);
        }),
        tap((tasks) => {
          this.tasksByProjectSignal.update((map) => ({ ...map, [projectId]: tasks }));
        }),
      );
  }

  tasksForProject(projectId: number): Task[] {
    return this.tasksByProjectSignal()[projectId] ?? [];
  }

  openTaskCountForSprint(projectId: number, sprintId: number): number {
    return this.tasksForProject(projectId).filter(
      (t) => t.sprintId === sprintId && t.status !== 'Done',
    ).length;
  }

  private syncProjectTaskCache(tasks: Task[]): void {
    const byProject: Record<number, Task[]> = { ...this.tasksByProjectSignal() };
    for (const task of tasks) {
      if (task.projectId === undefined) continue;
      const pid = task.projectId;
      const list = byProject[pid] ?? [];
      const idx = list.findIndex((t) => t.id === task.id);
      if (idx >= 0) list[idx] = task;
      else list.push(task);
      byProject[pid] = list;
    }
    this.tasksByProjectSignal.set(byProject);
  }

  private removeFromProjectTaskCache(taskId: string, projectId?: number): void {
    if (projectId === undefined) {
      this.tasksByProjectSignal.update((map) => {
        const next = { ...map };
        for (const pid of Object.keys(next)) {
          next[Number(pid)] = next[Number(pid)].filter((t) => t.id !== taskId);
        }
        return next;
      });
      return;
    }

    this.tasksByProjectSignal.update((map) => ({
      ...map,
      [projectId]: (map[projectId] ?? []).filter((t) => t.id !== taskId),
    }));
  }

  getTask(id: string): Task | undefined {
    return this.tasksSignal().find((t) => t.id === id);
  }

  getTaskById(id: string): Observable<Task | null> {
    const numId = parseTaskId(id);
    if (numId === null) return of(null);
    return this.http
      .get<TaskApiResponse>(`${TASK_BASE}/GetTaskById`, { params: { id: numId } })
      .pipe(
        map(apiToTask),
        catchError(() => of(null)),
      );
  }

  addTask(input: AddTaskInput): Observable<Task | null> {
    const params = input;
    const title = (params.title ?? '').trim();
    if (!title) throw new Error('Task title is required');
    if (params.projectId === undefined || Number.isNaN(Number(params.projectId))) {
      throw new Error('Task projectId is required');
    }

    const dto: CreateTaskDto = toCreateDto(params, title);
    return this.http.post<TaskApiResponse>(`${TASK_BASE}/CreateNewTask`, dto).pipe(
      tap((created) => {
        const task = apiToTask(created);
        this.tasksSignal.update((list) => [...list, task]);
        this.syncProjectTaskCache([task]);
      }),
      map(apiToTask),
      catchError(() => of(null)),
    );
  }

  updateTask(id: string, input: UpdateTaskInput): Observable<boolean> {
    const numId = parseTaskId(id);
    if (numId === null) return of(false);
    if (input.title !== undefined && !input.title?.trim()) {
      throw new Error('Task title is required');
    }

    const existing = this.getTask(id);
    const dto: UpdateTaskDto = toUpdateDto(numId, input, existing);
    const now = Date.now();

    return this.http.put<unknown>(`${TASK_BASE}/UpdateTaskById`, dto).pipe(
      tap(() => {
        let updatedTask: Task | undefined;
        this.tasksSignal.update((list) =>
          list.map((t) => {
            if (t.id !== id) return t;
            updatedTask = {
              ...t,
              ...(input.title !== undefined && { title: input.title.trim() }),
              ...(input.description !== undefined && {
                description: input.description,
              }),
              ...(input.priority !== undefined && { priority: input.priority }),
              ...(input.status !== undefined && { status: input.status }),
              ...(input.projectId !== undefined && { projectId: input.projectId }),
              updatedAt: now,
            };
            return updatedTask;
          }),
        );
        if (updatedTask) this.syncProjectTaskCache([updatedTask]);
      }),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  setStatus(id: string, status: TaskStatus): Observable<boolean> {
    return this.updateTask(id, { status });
  }

  toggleCompleted(id: string): Observable<boolean> {
    const task = this.getTask(id);
    if (!task) return of(false);
    const nextStatus: TaskStatus = task.status === 'Done' ? 'Open' : 'Done';
    return this.setStatus(id, nextStatus);
  }

  deleteTask(id: string): Observable<boolean> {
    const numId = parseTaskId(id);
    if (numId === null) return of(false);
    return this.http
      .delete<unknown>(`${TASK_BASE}/DeleteTaskById`, {
        params: { id: numId },
      })
      .pipe(
        tap(() => {
          const existing = this.getTask(id);
          this.tasksSignal.update((list) => list.filter((t) => t.id !== id));
          this.removeFromProjectTaskCache(id, existing?.projectId);
        }),
        map(() => true),
        catchError(() => of(false)),
      );
  }

  clearCompleted(): Observable<boolean> {
    const completed = this.tasksSignal().filter((t) => t.status === 'Done');
    if (completed.length === 0) return of(true);
    return forkJoin(completed.map((t) => this.deleteTask(t.id))).pipe(
      map((results) => results.every(Boolean)),
      catchError(() => of(false)),
    );
  }
}
