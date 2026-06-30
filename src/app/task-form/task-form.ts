import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { TaskService } from '../services/task-service';
import { TaskUserService } from '../services/task-user-service';
import { ProjectService } from '../services/project-service';
import { ProfileMenu } from '../profile-menu/profile-menu';
import { CommonModule } from '@angular/common';

import {
  type Task,
  type TaskStatus,
  type TaskPriority,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
} from '../model/task';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './task-form.html',
})
export class TaskForm implements OnInit {
  taskForm!: FormGroup;

  error = '';
  submitting = false;
  searchTerm = signal('');

  readonly isEditMode = signal(false);
  private taskId: string | null = null;
  private sprintId: number | null = null;

  readonly statusOptions = TASK_STATUS_OPTIONS;
  readonly priorityOptions = TASK_PRIORITY_OPTIONS;

  private readonly taskUserService = inject(TaskUserService);
  readonly users = this.taskUserService.users;
  readonly usersLoading = this.taskUserService.loading;
  readonly usersError = this.taskUserService.error;
  readonly selectedUserIds = signal<Set<string>>(new Set());

  constructor(
    private taskService: TaskService,
    readonly projectService: ProjectService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.taskUserService.loadUsers().subscribe();
    this.projectService.loadProjects().subscribe();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.taskForm.get('projectId')?.disable({ emitEvent: false });
      this.loadTask(id);
    } else {
      const qp = this.route.snapshot.queryParamMap.get('projectId');
      const n = qp ? parseInt(qp, 10) : NaN;
      if (!Number.isNaN(n)) {
        this.taskForm.patchValue({ projectId: n });
      }
      this.sprintId = this.parseSprintIdFromQuery(
        this.route.snapshot.queryParamMap.get('sprintId'),
      );
    }
  }

  private parseSprintIdFromQuery(raw: string | null): number | null {
    if (raw === null || raw === '' || raw === 'null') return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }

  toggleUser(userId: string): void {
    this.selectedUserIds.update((set) => {
      const next = new Set(set);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUserIds().has(userId);
  }

  private initForm(): void {
    this.taskForm = new FormGroup({
      title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl('', { nonNullable: true }),
      //dueDateInput: new FormControl('', { nonNullable: true }),
      priority: new FormControl<TaskPriority>('Medium', { nonNullable: true }),
      //category: new FormControl('', { nonNullable: true }),
      status: new FormControl<TaskStatus>('Open', { nonNullable: true }),
      projectId: new FormControl<number | null>(null, Validators.required),
    });
  }

  private loadTask(id: string): void {
    const localTask = this.taskService.getTask(id);

    if (localTask) {
      this.applyTask(localTask, id);
    } else {
      this.taskService.getTaskById(id).subscribe((task) => {
        if (task) this.applyTask(task, id);
      });
    }
  }

  private applyTask(task: Task, id: string): void {
    this.taskId = id;
    this.isEditMode.set(true);
    this.sprintId = task.sprintId ?? null;

    this.taskForm.patchValue({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      //category: task.category ?? '',
      status: task.status,
      projectId: task.projectId ?? null,
      //dueDateInput: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    });

    this.taskForm.get('projectId')?.disable({ emitEvent: false });

    const userIds = task.users?.map((u) => u.id).filter((uid) => uid?.trim()) ?? [];

    this.selectedUserIds.set(new Set(userIds));
  }

  private resetForm(): void {
    this.taskForm.reset({
      title: '',
      description: '',
      //dueDateInput: '',
      priority: 'Medium',
      //category: '',
      status: 'Open',
      projectId: null,
    });
    this.taskForm.get('projectId')?.enable({ emitEvent: false });
    this.selectedUserIds.set(new Set());
  }

  submit(): void {
    this.error = '';

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    if (this.submitting) return;
    this.submitting = true;

    const formValue = this.taskForm.getRawValue();
    const projectId = Number(formValue.projectId);
    if (Number.isNaN(projectId)) {
      this.submitting = false;
      this.error = 'Select a project for this task.';
      return;
    }

    const payload = {
      title: formValue.title.trim(),
      description: formValue.description.trim() || undefined,
      priority: formValue.priority,
      status: formValue.status,
      projectId,
      sprintId: this.sprintId,
      userIds: Array.from(this.selectedUserIds()).filter((uid) => uid?.trim()),
    };

    if (this.taskId) {
      this.taskService.updateTask(this.taskId, payload).subscribe({
        next: (ok) => {
          this.submitting = false;
          if (ok) this.navigateAfterSave(projectId, this.sprintId);
          else this.error = 'Could not update task. Try again.';
        },
        error: () => {
          this.submitting = false;
          this.error = 'Could not update task. Try again.';
        },
      });
    } else {
      this.taskService.addTask(payload).subscribe({
        next: (task) => {
          this.submitting = false;
          if (task) {
            this.resetForm();
            this.navigateAfterSave(projectId, this.sprintId);
          } else {
            this.error = 'Could not add task. Try again.';
          }
        },
        error: () => {
          this.submitting = false;
          this.error = 'Could not add task. Try again.';
        },
      });
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

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();

    const list = this.users().filter((u) => u.id?.trim());

    if (!term) return list;

    return list.filter((u) => u.fullName.toLowerCase().includes(term));
  });

  projectLabel(): string {
    const id = this.taskForm?.getRawValue()?.projectId as number | null | undefined;
    if (id === null || id === undefined || Number.isNaN(Number(id))) return '—';
    const p = this.projectService.projects().find((x) => x.id === id);
    return p?.title ?? `#${id}`;
  }

  taskListBackLink(): string {
    const id = this.taskForm.getRawValue().projectId as number | null;
    if (id !== null && !Number.isNaN(Number(id))) {
      if (this.sprintId != null) return `/project/${id}/sprint/${this.sprintId}`;
      return `/project/${id}/backlog`;
    }
    return '/project/list';
  }

  private navigateAfterSave(projectId: number, sprintId: number | null): void {
    if (sprintId != null) {
      this.router.navigate(['/project', projectId, 'sprint', sprintId]);
    } else {
      this.router.navigate(['/project', projectId, 'backlog']);
    }
  }
}
