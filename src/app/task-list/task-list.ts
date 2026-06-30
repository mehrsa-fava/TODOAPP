import { Component, computed, signal, OnInit, HostListener } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../services/task-service';
import { TaskUserService } from '../services/task-user-service';
import { SprintService } from '../services/sprint-service';
import { ProjectService } from '../services/project-service';
import type { Task, TaskStatus, TaskPriority } from '../model/task';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../model/task';

export type TaskListFilter = 'all' | 'active' | 'completed';

const FILTER_TABS: { value: TaskListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export type EditingField = 'title' | 'description' | 'status' | 'priority' | 'users' | null;

@Component({
  selector: 'app-task-list',
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './task-list.html',
  styleUrl: './task-list.css',
})
export class TaskList implements OnInit {
  private readonly filterSignal = signal<TaskListFilter>('all');

  readonly projectId = signal<number | null>(null);
  /** 'backlog' = sprintId is null; number = specific sprint */
  readonly sprintFilter = signal<'backlog' | number>('backlog');

  constructor(
    protected taskService: TaskService,
    protected taskUserService: TaskUserService,
    protected sprintService: SprintService,
    protected projectService: ProjectService,
    private readonly route: ActivatedRoute,
  ) {}

  readonly filterTabs = FILTER_TABS;
  readonly filter = this.filterSignal.asReadonly();
  readonly filteredTasks = computed(() => {
    const tasks = this.taskService.tasks();
    const f = this.filterSignal();
    const sprintFilter = this.sprintFilter();

    let scoped =
      sprintFilter === 'backlog'
        ? tasks.filter((t) => t.sprintId == null)
        : tasks.filter((t) => t.sprintId === sprintFilter);

    if (f === 'active') return scoped.filter((t) => t.status !== 'Done');
    if (f === 'completed') return scoped.filter((t) => t.status === 'Done');

    return scoped;
  });

  readonly viewTitle = computed(() => {
    const sprintFilter = this.sprintFilter();
    if (sprintFilter === 'backlog') return 'Backlogs';
    const pid = this.projectId();
    if (pid === null) return 'Sprint';
    const sprint = this.sprintService.sprintsForProject(pid).find((s) => s.id === sprintFilter);
    return sprint?.title ?? 'Sprint';
  });

  readonly projectTitle = computed(() => {
    const pid = this.projectId();
    if (pid === null) return '';
    return this.projectService.projects().find((p) => p.id === pid)?.title ?? '';
  });

  readonly activeSprint = computed(() => {
    const sprintFilter = this.sprintFilter();
    const pid = this.projectId();
    if (sprintFilter === 'backlog' || pid === null) return null;
    return this.sprintService.sprintsForProject(pid).find((s) => s.id === sprintFilter) ?? null;
  });

  readonly viewSubtitle = computed(() => {
    const sprint = this.activeSprint();
    if (!sprint) return 'Tasks not assigned to a sprint.';
    if (sprint.startDate && sprint.endDate) {
      return `${sprint.startDate} → ${sprint.endDate}`;
    }
    return 'Tasks in this sprint.';
  });

  ngOnInit(): void {
    this.projectService.loadProjects().subscribe();
    this.route.paramMap.subscribe((pm) => {
      const rawProject = pm.get('projectId');
      const rawSprint = pm.get('sprintId');
      const projectId = rawProject ? parseInt(rawProject, 10) : NaN;

      if (!Number.isNaN(projectId)) {
        this.projectId.set(projectId);
        if (rawSprint) {
          const sprintId = parseInt(rawSprint, 10);
          this.sprintFilter.set(Number.isNaN(sprintId) ? 'backlog' : sprintId);
          this.sprintService.loadSprints(projectId).subscribe();
        } else {
          this.sprintFilter.set('backlog');
        }
        this.taskService.loadTasksByProjectId(projectId).subscribe();
      } else {
        this.projectId.set(null);
      }
    });
    this.taskUserService.loadUsers().subscribe();
  }

  private reloadTasksForProject(): void {
    const pid = this.projectId();
    if (pid !== null) this.taskService.loadTasksByProjectId(pid).subscribe();
  }

  addTaskQueryParams(): { projectId: number; sprintId?: number } | Record<string, never> {
    const pid = this.projectId();
    if (pid === null) return {};
    const sf = this.sprintFilter();
    if (sf === 'backlog') return { projectId: pid };
    return { projectId: pid, sprintId: sf };
  }

  setFilter(value: TaskListFilter | string): void {
    this.filterSignal.set(value as TaskListFilter);
  }

  isCompleted(task: Task): boolean {
    return task.status === 'Done';
  }

  //formatDueDate = formatShortDate;

  toggle(task: Task): void {
    this.taskService.toggleCompleted(task.id).subscribe();
  }

  delete(task: Task): void {
    this.taskService.deleteTask(task.id).subscribe();
  }

  clearCompleted(): void {
    this.taskService.clearCompleted().subscribe(() => this.reloadTasksForProject());
  }

  // ─── Inline Editing State ───

  readonly editingTaskId = signal<string | null>(null);
  readonly editingField = signal<EditingField>(null);
  readonly editValue = signal<string>('');
  readonly selectedUserIds = signal<Set<string>>(new Set());

  readonly statusOptions = TASK_STATUS_OPTIONS;
  readonly priorityOptions = TASK_PRIORITY_OPTIONS;

  isEditing(taskId: string, field: NonNullable<EditingField>): boolean {
    return this.editingTaskId() === taskId && this.editingField() === field;
  }

  startEdit(task: Task, field: NonNullable<EditingField>): void {
    this.editingTaskId.set(task.id);
    this.editingField.set(field);

    if (field === 'title') {
      this.editValue.set(task.title);
    } else if (field === 'description') {
      this.editValue.set(task.description ?? '');
    } else if (field === 'status') {
      this.editValue.set(task.status);
    } else if (field === 'priority') {
      this.editValue.set(task.priority);
    }
  }

  cancelEdit(): void {
    this.editingTaskId.set(null);
    this.editingField.set(null);
    this.editValue.set('');
    this.selectedUserIds.set(new Set());
  }

  saveEdit(taskId: string): void {
    const field = this.editingField();
    if (!field) return;

    const value = this.editValue().trim();

    if (field === 'title') {
      if (!value) {
        this.cancelEdit();
        return;
      }
      this.taskService.updateTask(taskId, { title: value }).subscribe(() => this.cancelEdit());
    } else if (field === 'description') {
      this.taskService
        .updateTask(taskId, { description: value })
        .subscribe(() => this.cancelEdit());
    } else if (field === 'status') {
      this.taskService
        .updateTask(taskId, { status: value as TaskStatus })
        .subscribe(() => this.cancelEdit());
    } else if (field === 'priority') {
      this.taskService
        .updateTask(taskId, { priority: value as TaskPriority })
        .subscribe(() => this.cancelEdit());
    }
  }

  onKeydown(event: KeyboardEvent, taskId: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveEdit(taskId);
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  startUsersEdit(task: Task): void {
    this.editingTaskId.set(task.id);
    this.editingField.set('users');
    this.selectedUserIds.set(new Set((task.users ?? []).map((u) => u.id)));
  }

  toggleUserInEdit(userId: string): void {
    this.selectedUserIds.update((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  isUserSelectedInEdit(userId: string): boolean {
    return this.selectedUserIds().has(userId);
  }

  saveUsersEdit(taskId: string): void {
    const task = this.taskService.getTask(taskId);
    if (!task) {
      this.cancelEdit();
      return;
    }

    const nextUserIds = Array.from(this.selectedUserIds());
    const currentUserIds = (task.users ?? []).map((u) => u.id);
    const hasChanges =
      nextUserIds.length !== currentUserIds.length ||
      nextUserIds.some((id) => !currentUserIds.includes(id));

    if (!hasChanges) {
      this.cancelEdit();
      return;
    }

    this.taskService.updateTask(taskId, { userIds: nextUserIds }).subscribe(() => {
      this.cancelEdit();
      this.reloadTasksForProject();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.editingField() !== 'users') return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.users-edit-container')) return;

    const taskId = this.editingTaskId();
    if (!taskId) {
      this.cancelEdit();
      return;
    }

    this.saveUsersEdit(taskId);
  }

  selectStatus(taskId: string, status: TaskStatus): void {
    this.editValue.set(status);
    this.saveEdit(taskId);
  }

  selectPriority(taskId: string, priority: TaskPriority): void {
    this.editValue.set(priority);
    this.saveEdit(taskId);
  }

  // ─── Status Color Helpers ───

  statusBgClass(status: TaskStatus): string {
    switch (status) {
      case 'Open':
        return 'bg-slate-100';
      case 'InProgress':
        return 'bg-amber-100';
      case 'Completed':
        return 'bg-emerald-100';
      case 'InReview':
        return 'bg-indigo-100';
      case 'Accept':
        return 'bg-purple-100';
      case 'Reject':
        return 'bg-red-100';
      case 'Done':
        return 'bg-green-100';
      case 'Pending':
        return 'bg-blue-100';
      case 'Block':
        return 'bg-gray-100';
      default:
        return 'bg-slate-100';
    }
  }

  statusTextClass(status: TaskStatus): string {
    switch (status) {
      case 'Open':
        return 'text-slate-700';
      case 'InProgress':
        return 'text-amber-800';
      case 'Completed':
        return 'text-emerald-800';
      case 'InReview':
        return 'text-indigo-800';
      case 'Accept':
        return 'text-purple-800';
      case 'Reject':
        return 'text-red-800';
      case 'Done':
        return 'text-green-800';
      case 'Pending':
        return 'text-blue-800';
      case 'Block':
        return 'text-gray-800';
      default:
        return 'text-slate-700';
    }
  }

  priorityColorClass(priority: TaskPriority): string {
    switch (priority) {
      case 'Low':
        return 'text-slate-400';
      case 'Medium':
        return 'text-slate-500';
      case 'High':
        return 'text-yellow-500';
      case 'Urgent':
        return 'text-red-500';
      default:
        return 'text-slate-500';
    }
  }

  getInitial(name?: string): string {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase();
  }

  getAvatarColor(id: string): string {
    const colors = ['bg-indigo-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-pink-500'];

    let hash = 0;

    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }
}
