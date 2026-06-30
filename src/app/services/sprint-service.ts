import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  CreateSprintApiResponse,
  CreateSprintInput,
  Sprint,
  UpdateSprintInput,
} from '../model/sprint';
import { getApiErrorMessage } from '../utils/api-error.util';

const SPRINT_BASE = `${environment.api}/Sprint`;

function toDateInputValue(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  return String(raw).slice(0, 10);
}

function normalizeSprint(raw: Record<string, unknown>, projectId?: number): Sprint {
  const id = raw['id'] ?? raw['Id'];
  const title = raw['title'] ?? raw['Title'];
  const startDate = raw['startDate'] ?? raw['StartDate'];
  const endDate = raw['endDate'] ?? raw['EndDate'];
  const tasks = raw['tasks'] ?? raw['Tasks'];
  const pid = projectId ?? raw['projectId'] ?? raw['ProjectId'];
  return {
    id: Number(id),
    title: String(title ?? 'Sprint'),
    projectId: Number(pid ?? 0),
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
    ...(Array.isArray(tasks) ? { tasks } : {}),
  };
}

@Injectable({
  providedIn: 'root',
})
export class SprintService {
  private readonly sprintsByProjectSignal = signal<Record<number, Sprint[]>>({});
  private readonly loadingProjectsSignal = signal<Set<number>>(new Set());
  private readonly errorSignal = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  readonly sprintsByProject = this.sprintsByProjectSignal.asReadonly();
  readonly loadingProjects = this.loadingProjectsSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  sprintsForProject(projectId: number): Sprint[] {
    return this.sprintsByProjectSignal()[projectId] ?? [];
  }

  isLoading(projectId: number): boolean {
    return this.loadingProjectsSignal().has(projectId);
  }

  loadSprints(projectId: number): Observable<Sprint[]> {
    this.loadingProjectsSignal.update((set) => new Set(set).add(projectId));
    this.errorSignal.set(null);

    return this.http
      .get<unknown[]>(`${SPRINT_BASE}/GetAllSprints`, { params: { projectId } })
      .pipe(
        tap(() =>
          this.loadingProjectsSignal.update((set) => {
            const next = new Set(set);
            next.delete(projectId);
            return next;
          }),
        ),
        catchError((err) => {
          this.loadingProjectsSignal.update((set) => {
            const next = new Set(set);
            next.delete(projectId);
            return next;
          });
          this.errorSignal.set(getApiErrorMessage(err, 'Failed to load sprints'));
          return of([]);
        }),
        map((list) =>
          (list ?? []).map((item) =>
            normalizeSprint(item as Record<string, unknown>, projectId),
          ),
        ),
        tap((sprints) => {
          this.sprintsByProjectSignal.update((map) => ({ ...map, [projectId]: sprints }));
          this.errorSignal.set(null);
        }),
      );
  }

  getSprintById(id: number): Observable<Sprint | null> {
    return this.http.get<unknown>(`${SPRINT_BASE}/GetSprintById`, { params: { id } }).pipe(
      map((body) => normalizeSprint(body as Record<string, unknown>)),
      catchError(() => of(null)),
    );
  }

  createSprint(input: CreateSprintInput): Observable<CreateSprintApiResponse | null> {
    const body = {
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      projectId: input.projectId,
    };
    return this.http.post<CreateSprintApiResponse>(`${SPRINT_BASE}/CreateNewSprint`, body).pipe(
      tap((res) => {
        if (res?.success && typeof res.id === 'number') {
          this.upsertSprintInCache({
            id: res.id,
            title: body.title,
            startDate: body.startDate,
            endDate: body.endDate,
            projectId: body.projectId,
          });
        }
      }),
      catchError(() => of(null)),
    );
  }

  updateSprint(input: UpdateSprintInput): Observable<boolean> {
    const body = {
      id: input.id,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
    };
    return this.http.put<unknown>(`${SPRINT_BASE}/UpdateSprintById`, body).pipe(
      tap(() => {
        this.sprintsByProjectSignal.update((map) => {
          const next = { ...map };
          for (const projectId of Object.keys(next)) {
            const pid = Number(projectId);
            next[pid] = next[pid].map((s) =>
              s.id === input.id
                ? { ...s, title: body.title, startDate: body.startDate, endDate: body.endDate }
                : s,
            );
          }
          return next;
        });
      }),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  deleteSprint(id: number, projectId: number): Observable<boolean> {
    return this.http.delete<unknown>(`${SPRINT_BASE}/DeleteSprintById`, { params: { id } }).pipe(
      tap(() => {
        this.sprintsByProjectSignal.update((map) => ({
          ...map,
          [projectId]: (map[projectId] ?? []).filter((s) => s.id !== id),
        }));
      }),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  private upsertSprintInCache(sprint: Sprint): void {
    this.sprintsByProjectSignal.update((map) => {
      const list = map[sprint.projectId] ?? [];
      const exists = list.some((s) => s.id === sprint.id);
      return {
        ...map,
        [sprint.projectId]: exists
          ? list.map((s) => (s.id === sprint.id ? sprint : s))
          : [...list, sprint],
      };
    });
  }
}
