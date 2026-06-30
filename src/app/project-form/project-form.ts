import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProjectService } from '../services/project-service';
import { TaskUserService } from '../services/task-user-service';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule],
  templateUrl: './project-form.html',
})
export class ProjectForm implements OnInit {
  projectForm!: FormGroup;

  error = '';
  submitting = false;
  searchTerm = signal('');

  readonly isEditMode = signal(false);
  private projectNumericId: number | null = null;

  private readonly taskUserService = inject(TaskUserService);
  readonly users = this.taskUserService.users;
  readonly usersLoading = this.taskUserService.loading;
  readonly usersError = this.taskUserService.error;
  readonly selectedUserIds = signal<Set<string>>(new Set());

  constructor(
    private readonly projectService: ProjectService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.taskUserService.loadUsers().subscribe();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const num = parseInt(idParam, 10);
      if (!Number.isNaN(num)) this.loadProject(num);
    }
  }

  toggleUser(userId: string): void {
    if (!userId) return;
    this.selectedUserIds.update((set) => {
      const next = new Set(set);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUserIds().has(userId);
  }

  private initForm(): void {
    this.projectForm = new FormGroup({
      title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  private loadProject(id: number): void {
    this.projectService.getProjectById(id).subscribe((project) => {
      if (!project) return;
      this.projectNumericId = project.id;
      this.isEditMode.set(true);
      this.projectForm.patchValue({ title: project.title });
      this.selectedUserIds.set(new Set((project.userIds ?? []).filter(Boolean)));
    });
  }

  submit(): void {
    this.error = '';

    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    if (this.submitting) return;
    this.submitting = true;

    const title = this.projectForm.getRawValue().title as string;
    const userIds = Array.from(this.selectedUserIds()).filter((id) => id?.trim());

    if (this.projectNumericId !== null) {
      this.projectService
        .updateProject({ id: this.projectNumericId, title, userIds })
        .subscribe({
          next: (ok) => {
            this.submitting = false;
            if (ok) this.router.navigate(['/project/list']);
            else this.error = 'Could not update project. Try again.';
          },
          error: () => {
            this.submitting = false;
            this.error = 'Could not update project. Try again.';
          },
        });
    } else {
      this.projectService.createProject({ title, userIds }).subscribe({
        next: (res) => {
          this.submitting = false;
          if (res?.success) this.router.navigate(['/project/list']);
          else this.error = res?.message?.trim() || 'Could not create project. Try again.';
        },
        error: () => {
          this.submitting = false;
          this.error = 'Could not create project. Try again.';
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
    const key = id || 'anonymous';
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const list = this.users().filter((u) => u.id?.trim());
    if (!term) return list;
    return list.filter((u) => u.fullName.toLowerCase().includes(term));
  });

  backLink(): string {
    return this.isEditMode() && this.projectNumericId !== null
      ? `/project/${this.projectNumericId}/backlog`
      : '/project/list';
  }

  deleteProject(): void {
    if (this.projectNumericId === null || this.submitting) return;
    if (!confirm('Delete this project? This cannot be undone.')) return;

    this.submitting = true;
    const id = this.projectNumericId;
    this.projectService.deleteProject(id).subscribe({
      next: (ok) => {
        this.submitting = false;
        if (ok) this.router.navigate(['/project/list']);
        else this.error = 'Could not delete project. Try again.';
      },
      error: () => {
        this.submitting = false;
        this.error = 'Could not delete project. Try again.';
      },
    });
  }
}
