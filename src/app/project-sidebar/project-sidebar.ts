import { Component, OnInit, signal, computed } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { filter } from 'rxjs';
import { ProjectService } from '../services/project-service';
import { SprintService } from '../services/sprint-service';
import { TaskService } from '../services/task-service';
import { ProfileMenu } from '../profile-menu/profile-menu';
import { getProjectIconStyle } from '../utils/project-icon.util';
import {
  formatSprintLabel,
  getNextSprintName,
  getSprintStatus,
  sortSprintsByStartDate,
  type SprintStatus,
} from '../utils/sprint.util';
import type { Project } from '../model/project';
import type { Sprint } from '../model/sprint';

@Component({
  selector: 'app-project-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass, ProfileMenu],
  templateUrl: './project-sidebar.html',
  styleUrl: './project-sidebar.css',
})
export class ProjectSidebar implements OnInit {
  readonly expandedProjects = signal<Set<number>>(new Set());
  readonly expandedSprintsFolders = signal<Set<number>>(new Set());
  readonly hoveredProjectId = signal<number | null>(null);
  readonly hoveredSprintKey = signal<string | null>(null);

  constructor(
    protected readonly projectService: ProjectService,
    protected readonly sprintService: SprintService,
    protected readonly taskService: TaskService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.projectService.loadProjects().subscribe((projects) => {
      this.syncFromUrl(this.router.url);
      if (projects.length > 0 && this.expandedProjects().size === 0) {
        this.toggleProject(projects[0].id, true);
      }
    });

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.syncFromUrl((e as NavigationEnd).urlAfterRedirects);
    });
  }

  private syncFromUrl(url: string): void {
    const projectMatch = url.match(/\/project\/(\d+)/);
    if (projectMatch) {
      const projectId = parseInt(projectMatch[1], 10);
      if (!Number.isNaN(projectId)) {
        this.expandProjectSprints(projectId, url);
      }
      return;
    }

    const sprintFormMatch = url.match(/\/sprint\/form(?:\/(\d+))?/);
    if (sprintFormMatch) {
      const queryProjectId = this.router.parseUrl(url).queryParams['projectId'];
      const projectId = queryProjectId ? parseInt(String(queryProjectId), 10) : NaN;
      if (!Number.isNaN(projectId)) {
        this.expandedProjects.update((set) => new Set(set).add(projectId));
        this.expandProjectSprints(projectId, url);
      }
    }
  }

  private expandProjectSprints(projectId: number, url: string): void {
    this.expandedProjects.update((set) => new Set(set).add(projectId));

    if (url.includes('/sprint/') || url.includes('/sprint/form')) {
      this.expandedSprintsFolders.update((set) => new Set(set).add(projectId));
      if (!this.sprintService.sprintsForProject(projectId).length) {
        this.sprintService
          .loadSprints(projectId)
          .subscribe(() => this.ensureProjectTasksLoaded(projectId));
      } else {
        this.ensureProjectTasksLoaded(projectId);
      }
    }
  }

  sprintRowKey(projectId: number, sprintId: number): string {
    return `${projectId}-${sprintId}`;
  }

  deleteSprint(projectId: number, sprintId: number, title: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`Delete sprint "${title}"?`)) return;

    this.sprintService.deleteSprint(sprintId, projectId).subscribe((ok) => {
      if (!ok) return;
      if (this.router.url.includes(`/sprint/${sprintId}`)) {
        this.router.navigate(['/project', projectId, 'backlog']);
      }
    });
  }

  projects = computed(() => this.projectService.projects());

  iconStyle(project: Project) {
    return getProjectIconStyle(project.title, project.id);
  }

  isProjectExpanded(projectId: number): boolean {
    return this.expandedProjects().has(projectId);
  }

  isSprintsFolderExpanded(projectId: number): boolean {
    return this.expandedSprintsFolders().has(projectId);
  }

  toggleProject(projectId: number, expandOnly = false): void {
    const wasExpanded = this.expandedProjects().has(projectId);
    if (wasExpanded && !expandOnly) {
      this.expandedProjects.update((set) => {
        const next = new Set(set);
        next.delete(projectId);
        return next;
      });
      return;
    }

    this.expandedProjects.update((set) => new Set(set).add(projectId));
    if (
      !this.sprintService.sprintsForProject(projectId).length &&
      !this.sprintService.isLoading(projectId)
    ) {
      this.sprintService
        .loadSprints(projectId)
        .subscribe(() => this.ensureProjectTasksLoaded(projectId));
    } else {
      this.ensureProjectTasksLoaded(projectId);
    }
  }

  toggleSprintsFolder(projectId: number, event: Event): void {
    event.stopPropagation();
    this.expandedProjects.update((set) => new Set(set).add(projectId));

    const isOpen = this.expandedSprintsFolders().has(projectId);
    if (isOpen) {
      this.expandedSprintsFolders.update((set) => {
        const next = new Set(set);
        next.delete(projectId);
        return next;
      });
    } else {
      this.expandedSprintsFolders.update((set) => new Set(set).add(projectId));
      this.ensureSprintsLoaded(projectId);
    }
  }

  suggestedSprintName(projectId: number): string {
    return getNextSprintName(this.sprintService.sprintsForProject(projectId));
  }

  /** Keeps sprint badges reactive to task cache updates. */
  readonly taskCacheVersion = computed(() => this.taskService.tasksByProject());

  sprintsFor(projectId: number): Sprint[] {
    return sortSprintsByStartDate(this.sprintService.sprintsForProject(projectId));
  }

  sprintStatus(sprint: Sprint): SprintStatus {
    return getSprintStatus(sprint);
  }

  sprintLabel(sprint: Sprint): string {
    return formatSprintLabel(sprint);
  }

  openTaskBadgeCount(projectId: number, sprint: Sprint): number | null {
    this.taskCacheVersion();
    if (getSprintStatus(sprint) !== 'completed') return null;
    const count = this.taskService.openTaskCountForSprint(projectId, sprint.id);
    return count > 0 ? count : null;
  }

  private ensureProjectTasksLoaded(projectId: number): void {
    if (this.taskService.tasksForProject(projectId).length > 0) return;
    this.taskService.loadProjectTasksCache(projectId).subscribe();
  }

  private ensureSprintsLoaded(projectId: number): void {
    if (
      !this.sprintService.sprintsForProject(projectId).length &&
      !this.sprintService.isLoading(projectId)
    ) {
      this.sprintService
        .loadSprints(projectId)
        .subscribe(() => this.ensureProjectTasksLoaded(projectId));
      return;
    }
    this.ensureProjectTasksLoaded(projectId);
  }

  onProjectRowClick(project: Project): void {
    this.toggleProject(project.id);
    this.router.navigate(['/project', project.id, 'backlog']);
  }

  deleteProject(project: Project, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Delete project "${project.title}"? This cannot be undone.`)) return;

    this.projectService.deleteProject(project.id).subscribe((ok) => {
      if (!ok) return;

      this.expandedProjects.update((set) => {
        const next = new Set(set);
        next.delete(project.id);
        return next;
      });
      this.expandedSprintsFolders.update((set) => {
        const next = new Set(set);
        next.delete(project.id);
        return next;
      });

      if (this.router.url.includes(`/project/${project.id}`)) {
        this.router.navigate(['/project/list']);
      }
    });
  }

  getSprintProgress(startAt: string | Date, endAt: string | Date): number {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const now = new Date();

    // Normalize to midnight so hours don't affect the calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const passedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const progress = (passedDays / totalDays) * 100;

    return Math.min(100, Math.max(0, progress));
  }
}
