export type TaskStatus =
  | 'Open'
  | 'InProgress'
  | 'Completed'
  | 'InReview'
  | 'Accept'
  | 'Reject'
  | 'Done'
  | 'Pending'
  | 'Block';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskUser {
  id: string;
  fullName: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  /** @deprecated Use status instead. Kept for migration only. */
  completed?: boolean;
  description?: string;
  //dueDate?: number;
  priority: TaskPriority;
  //category?: string;
  createdAt: number;
  updatedAt: number;
  users: TaskUser[];
  projectId?: number;
  sprintId?: number | null;
}

export type AddTaskInput = {
  title: string;
  description?: string;
  //dueDate?: number;
  priority?: TaskPriority;
  //category?: string;
  status?: TaskStatus;
  userIds?: string[];
  projectId: number;
  sprintId?: number | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  //dueDate?: number;
  priority?: TaskPriority;
  //category?: string;
  status?: TaskStatus;
  userIds?: string[];
  projectId?: number;
  sprintId?: number | null;
};

/** Options for status and priority selects (shared by form and list). */
export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'Open', label: 'Open' },
  { value: 'InProgress', label: 'InProgress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'InReview', label: 'InReview' },
  { value: 'Accept', label: 'Accept' },
  { value: 'Reject', label: 'Reject' },
  { value: 'Done', label: 'Done' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Block', label: 'Block' },
];

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Urgent', label: 'Urgent' },
];
