import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { SprintService } from '../services/sprint-service';
import { ProjectService } from '../services/project-service';
import { PersianDateInputComponent } from '../persian-date-input/persian-date-input';
import { getNextSprintName } from '../utils/sprint.util';

@Component({
  selector: 'app-sprint-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, PersianDateInputComponent],
  templateUrl: './sprint-form.html',
})
export class SprintForm implements OnInit {
  sprintForm!: FormGroup;

  error = '';
  submitting = false;

  readonly isEditMode = signal(false);
  private sprintNumericId: number | null = null;
  private projectNumericId: number | null = null;

  constructor(
    private readonly sprintService: SprintService,
    readonly projectService: ProjectService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.projectService.loadProjects().subscribe();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const num = parseInt(idParam, 10);
      if (!Number.isNaN(num)) this.loadSprint(num);
      return;
    }

    const qp = this.route.snapshot.queryParamMap.get('projectId');
    const projectId = qp ? parseInt(qp, 10) : NaN;
    if (!Number.isNaN(projectId)) {
      this.projectNumericId = projectId;
      this.applySuggestedSprintName(projectId);
    }
  }

  private applySuggestedSprintName(projectId: number): void {
    const cached = this.sprintService.sprintsForProject(projectId);
    if (cached.length > 0) {
      this.sprintForm.patchValue({ title: getNextSprintName(cached) });
      return;
    }

    this.sprintService.loadSprints(projectId).subscribe((sprints) => {
      if (!this.isEditMode()) {
        this.sprintForm.patchValue({ title: getNextSprintName(sprints) });
      }
    });
  }

  private initForm(): void {
    this.sprintForm = new FormGroup({
      title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  private loadSprint(id: number): void {
    this.sprintService.getSprintById(id).subscribe((sprint) => {
      if (!sprint) return;

      const qp = this.route.snapshot.queryParamMap.get('projectId');
      const qpProjectId = qp ? parseInt(qp, 10) : NaN;
      const cachedProjectId = this.findProjectIdFromCache(id);

      this.sprintNumericId = sprint.id;
      this.projectNumericId =
        sprint.projectId > 0
          ? sprint.projectId
          : !Number.isNaN(qpProjectId)
            ? qpProjectId
            : cachedProjectId;

      this.isEditMode.set(true);
      this.sprintForm.patchValue({
        title: sprint.title,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      });
    });
  }

  private findProjectIdFromCache(sprintId: number): number | null {
    for (const [pid, list] of Object.entries(this.sprintService.sprintsByProject())) {
      if (list.some((s) => s.id === sprintId)) return Number(pid);
    }
    return null;
  }

  submit(): void {
    this.error = '';

    if (this.sprintForm.invalid) {
      this.sprintForm.markAllAsTouched();
      return;
    }

    if (this.submitting) return;
    this.submitting = true;

    const { title, startDate, endDate } = this.sprintForm.getRawValue();

    if (this.sprintNumericId !== null) {
      this.sprintService
        .updateSprint({ id: this.sprintNumericId, title, startDate, endDate })
        .subscribe({
          next: (ok) => {
            this.submitting = false;
            if (ok) this.navigateAfterSave(this.sprintNumericId!);
            else this.error = 'Could not update sprint. Try again.';
          },
          error: () => {
            this.submitting = false;
            this.error = 'Could not update sprint. Try again.';
          },
        });
    } else {
      if (this.projectNumericId === null) {
        this.submitting = false;
        this.error = 'Project is required to create a sprint.';
        return;
      }

      this.sprintService
        .createSprint({
          title,
          startDate,
          endDate,
          projectId: this.projectNumericId,
        })
        .subscribe({
          next: (res) => {
            this.submitting = false;
            if (res?.success) this.navigateAfterSave(res.id);
            else this.error = res?.message?.trim() || 'Could not create sprint. Try again.';
          },
          error: () => {
            this.submitting = false;
            this.error = 'Could not create sprint. Try again.';
          },
        });
    }
  }

  deleteSprint(): void {
    if (this.sprintNumericId === null || this.projectNumericId === null || this.submitting) return;
    if (!confirm('Delete this sprint? This cannot be undone.')) return;

    this.submitting = true;
    const sprintId = this.sprintNumericId;
    const projectId = this.projectNumericId;

    this.sprintService.deleteSprint(sprintId, projectId).subscribe({
      next: (ok) => {
        this.submitting = false;
        if (ok) this.router.navigate(['/project', projectId, 'backlog']);
        else this.error = 'Could not delete sprint. Try again.';
      },
      error: () => {
        this.submitting = false;
        this.error = 'Could not delete sprint. Try again.';
      },
    });
  }

  projectLabel(): string {
    const id = this.projectNumericId;
    if (id === null) return '—';
    return this.projectService.projects().find((p) => p.id === id)?.title ?? `#${id}`;
  }

  backLink(): string {
    if (this.projectNumericId !== null && this.sprintNumericId !== null) {
      return `/project/${this.projectNumericId}/sprint/${this.sprintNumericId}`;
    }
    if (this.projectNumericId !== null) {
      return `/project/${this.projectNumericId}/backlog`;
    }
    return '/project/list';
  }

  private navigateAfterSave(sprintId: number): void {
    if (this.projectNumericId !== null) {
      this.router.navigate(['/project', this.projectNumericId, 'sprint', sprintId]);
    } else {
      this.router.navigate(['/project/list']);
    }
  }
}
