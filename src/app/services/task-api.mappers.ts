import type { Task, TaskStatus, TaskPriority, TaskUser } from '../model/task';
import type { AddTaskInput, UpdateTaskInput } from '../model/task';
import type { TaskApiResponse, CreateTaskDto, UpdateTaskDto } from '../model/task-api';
import { TaskStatusApi, TaskPriorityApi } from '../model/task-api';

export function statusFromApi(n: number): TaskStatus {
  switch (n) {
    case TaskStatusApi.Open:
      return 'Open';
    case TaskStatusApi.InProgress:
      return 'InProgress';
    case TaskStatusApi.Completed:
      return 'Completed';
    case TaskStatusApi.InReview:
      return 'InReview';
    case TaskStatusApi.Accept:
      return 'Accept';
    case TaskStatusApi.Reject:
      return 'Reject';
    case TaskStatusApi.Done:
      return 'Done';
    case TaskStatusApi.Pending:
      return 'Pending';
    case TaskStatusApi.Block:
      return 'Block';
    default:
      return 'Open';
  }
}

export function statusToApi(s: TaskStatus): number {
  switch (s) {
    case 'Open':
      return TaskStatusApi.Open;
    case 'InProgress':
      return TaskStatusApi.InProgress;
    case 'Completed':
      return TaskStatusApi.Completed;
    case 'InReview':
      return TaskStatusApi.InReview;
    case 'Accept':
      return TaskStatusApi.Accept;
    case 'Reject':
      return TaskStatusApi.Reject;
    case 'Done':
      return TaskStatusApi.Done;
    case 'Pending':
      return TaskStatusApi.Pending;
    case 'Block':
      return TaskStatusApi.Block;
    default:
      return TaskStatusApi.Open;
  }
}

export function priorityFromApi(n: number): TaskPriority {
  switch (n) {
    case TaskPriorityApi.Low:
      return 'Low';
    case TaskPriorityApi.Medium:
      return 'Medium';
    case TaskPriorityApi.High:
      return 'High';
    case TaskPriorityApi.Urgent:
      return 'Urgent';
    default:
      return 'Medium';
  }
}

export function priorityToApi(p: TaskPriority): number {
  switch (p) {
    case 'Low':
      return TaskPriorityApi.Low;
    case 'Medium':
      return TaskPriorityApi.Medium;
    case 'High':
      return TaskPriorityApi.High;
    case 'Urgent':
      return TaskPriorityApi.Urgent;
    default:
      return TaskPriorityApi.Medium;
  }
}

/** Supports both PascalCase (C#) and camelCase (JSON) response shapes. */
export function apiToTask(api: TaskApiResponse): Task {
  const now = Date.now();
  const raw = api as unknown as Record<string, unknown>;
  const id = api.Id ?? raw['id'];
  const title = api.Title ?? raw['title'];
  const status = api.Status ?? raw['status'];
  const priority = api.Priority ?? raw['priority'];
  const description = api.Description ?? raw['description'];
  const users = api.Users ?? raw['Users'] ?? raw['users'];
  const projectIdRaw = api.ProjectId ?? raw['projectId'];
  const projectId =
    projectIdRaw === undefined || projectIdRaw === null ? undefined : Number(projectIdRaw);
  const sprintIdRaw = api.SprintId ?? raw['sprintId'];
  const sprintId =
    sprintIdRaw === undefined || sprintIdRaw === null ? null : Number(sprintIdRaw);
  const createdAt = api.CreatedAt ?? raw['createdAt'];
  const updatedAt = api.UpdatedAt ?? raw['updatedAt'];
  return {
    id: String(id),
    title: (title ?? '') as string,
    status: statusFromApi(Number(status)),
    description: (description ?? '') as string,
    priority: priorityFromApi(Number(priority)),
    users: Array.isArray(users)
      ? normalizeUsers(users as unknown as Record<string, unknown>[])
      : [],
    ...(projectId !== undefined && !Number.isNaN(projectId) ? { projectId } : {}),
    sprintId: sprintId !== null && !Number.isNaN(sprintId) ? sprintId : null,
    createdAt: createdAt ? new Date(createdAt as string).getTime() : now,
    updatedAt: updatedAt ? new Date(updatedAt as string).getTime() : now,
  };
}

function normalizeUsers(rows: Record<string, unknown>[]): TaskUser[] {
  return rows.map((row) => {
    const id = row['id'] ?? row['Id'];
    const fullName = row['fullName'] ?? row['FullName'];
    return {
      id: String(id ?? ''),
      fullName: String(fullName ?? 'Unknown User'),
    };
  });
}

export function toCreateDto(params: AddTaskInput, title: string): CreateTaskDto {
  return {
    Title: title,
    Description: params.description ?? '',
    Priority: priorityToApi(params.priority ?? 'Medium'),
    Status: statusToApi(params.status ?? 'Open'),
    ProjectId: params.projectId,
    SprintId: params.sprintId ?? null,
    UserIds: (params.userIds ?? []).filter((uid) => uid?.trim()),
  };
}

export function toUpdateDto(
  id: number,
  input: UpdateTaskInput,
  existing:
    | Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'users' | 'projectId' | 'sprintId'>
    | undefined,
): UpdateTaskDto {
  const rawUserIds = input.userIds ?? (existing?.users ?? []).map((u) => u.id);
  const sprintId =
    input.sprintId !== undefined ? input.sprintId : (existing?.sprintId ?? null);
  return {
    Id: id,
    Title: (input.title ?? existing?.title ?? '').trim(),
    Description: input.description ?? existing?.description ?? '',
    Priority: priorityToApi(input.priority ?? existing?.priority ?? 'Medium'),
    Status: statusToApi(input.status ?? existing?.status ?? 'Open'),
    ProjectId: input.projectId ?? existing?.projectId ?? 0,
    SprintId: sprintId,
    UserIds: rawUserIds.filter((uid) => uid?.trim()),
  };
}
