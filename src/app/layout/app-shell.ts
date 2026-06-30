import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProjectSidebar } from '../project-sidebar/project-sidebar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, ProjectSidebar],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {}
