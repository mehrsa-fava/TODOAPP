import { Routes } from '@angular/router';
import { TaskList } from './task-list/task-list';
import { Login } from './login/login';
import { Register } from './register/register';
import { TaskForm } from './task-form/task-form';
import { ProjectForm } from './project-form/project-form';
import { SprintForm } from './sprint-form/sprint-form';
import { AppShell } from './layout/app-shell';
import { WorkspaceHome } from './workspace-home/workspace-home';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'project/list', pathMatch: 'full' },
      { path: 'project/list', component: WorkspaceHome },
      {
        path: 'project/:projectId/backlog',
        component: TaskList,
      },
      {
        path: 'project/:projectId/sprint/:sprintId',
        component: TaskList,
      },
      {
        path: 'project/form',
        component: ProjectForm,
      },
      {
        path: 'project/form/:id',
        component: ProjectForm,
      },
      {
        path: 'sprint/form',
        component: SprintForm,
      },
      {
        path: 'sprint/form/:id',
        component: SprintForm,
      },
      {
        path: 'task/form',
        component: TaskForm,
      },
      {
        path: 'task/form/:id',
        component: TaskForm,
      },
    ],
  },
  { path: 'task/list', redirectTo: 'project/list', pathMatch: 'full', canActivate: [authGuard] },
  {
    path: 'task/list/:projectId',
    redirectTo: 'project/:projectId/backlog',
    pathMatch: 'full',
    canActivate: [authGuard],
  },
];
