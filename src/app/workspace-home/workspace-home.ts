import { Component } from '@angular/core';

@Component({
  selector: 'app-workspace-home',
  standalone: true,
  template: `
    <div class="workspace-home">
      <h1>Welcome</h1>
      <p>Select <strong>Backlogs</strong> or a <strong>Sprint</strong> from the sidebar to view tasks.</p>
    </div>
  `,
  styles: `
    .workspace-home {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: 2rem;
      text-align: center;
      color: #475569;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: #1e293b;
    }
    p {
      margin: 0;
      max-width: 24rem;
      line-height: 1.5;
    }
  `,
})
export class WorkspaceHome {}
