import type { Sprint } from '../model/sprint';
import { formatGregorianAsShamsiCompact } from './jalali-date.util';

export type SprintStatus = 'completed' | 'in-progress' | 'not-started';

const SPRINT_NAME_PATTERN = /^Sprint\s+(\d+)$/i;

/** Today as YYYY-MM-DD (local calendar day). */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDay(iso: string): string {
  return iso.trim().slice(0, 10);
}

export function getSprintStatus(
  sprint: Pick<Sprint, 'startDate' | 'endDate'>,
  nowIso: string = todayIso(),
): SprintStatus {
  const start = isoDay(sprint.startDate);
  const end = isoDay(sprint.endDate);
  if (!start || !end) return 'not-started';

  if (nowIso > end) return 'completed';
  if (nowIso < start) return 'not-started';
  return 'in-progress';
}

export function formatSprintDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = formatGregorianAsShamsiCompact(startDate);
  const end = formatGregorianAsShamsiCompact(endDate);

  if (!start && !end) return '';
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

export function formatSprintLabel(sprint: Sprint): string {
  const range = formatSprintDateRange(sprint.startDate, sprint.endDate);
  return range ? `${sprint.title} (${range})` : sprint.title;
}

/** Next auto name: Sprint 1, Sprint 2, … based on existing sprint titles. */
export function getNextSprintName(sprints: Sprint[]): string {
  let max = 0;
  for (const sprint of sprints) {
    const match = sprint.title.trim().match(SPRINT_NAME_PATTERN);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `Sprint ${max + 1}`;
}

export function sortSprintsByStartDate(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => {
    const aStart = isoDay(a.startDate);
    const bStart = isoDay(b.startDate);
    if (aStart && bStart && aStart !== bStart) return aStart.localeCompare(bStart);
    return a.id - b.id;
  });
}
