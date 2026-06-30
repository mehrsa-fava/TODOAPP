/** API DTOs and enum values matching the backend (C#). */

export const TaskStatusApi = {
  Open: 0,
  InProgress: 1,
  Completed: 2,
  InReview: 3,
  Accept: 4,
  Reject: 5,
  Done: 6,
  Pending: 7,
  Block: 8,
} as const;

export const TaskPriorityApi = {
  Low: 0,
  Medium: 1,
  High: 2,
  Urgent: 3,
} as const;

/** Request/response use PascalCase to match C# DTOs if API does not use camelCase. */
export interface CreateTaskDto {
  Title: string;
  Description: string;
  Priority: number;
  Status: number;
  ProjectId: number;
  SprintId: number | null;
  UserIds: string[];
}

export interface UpdateTaskDto {
  Id: number;
  Title: string;
  Description: string;
  Priority: number;
  Status: number;
  ProjectId: number;
  SprintId: number | null;
  UserIds: string[];
}

export interface UserDto {
  id: string;
  fullName: string;
}

export interface TaskApiResponse {
  Id: number;
  Title: string;
  Description?: string;
  Priority: number;
  Users: UserDto[];
  Status: number;
  ProjectId?: number;
  SprintId?: number | null;
  Tags?: unknown[];
  CreatedAt?: string;
  UpdatedAt?: string;
}
