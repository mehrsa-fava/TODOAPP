import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
//Router: مسئول جابه‌جایی بین صفحات است
import { AuthService } from '../services/auth-service';
//این همان سرویسی است که اطلاعات کاربر را نگهداری می‌کند.

@Component({
  selector: 'app-profile-menu',
  //یعنی هر جا بنویسیم app-profile-menu به این کامپوننت اشاره می‌کند(<app-profile-menu></app-profile-menu>)
  standalone: true,
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.css',
})

//این کلاس منطق کامپوننت را نگهداری می‌کند.
export class ProfileMenu {
  readonly currentUser; //تعریف متغیر
  isOpen = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.currentUser = this.authService.currentUser;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getInitials(): string {
    const name = this.currentUser()?.userName ?? '';
    return name.charAt(0).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-wrapper')) {
      this.close();
    }
  }
}

//سیگنال یک متغیر هوشمند است که انگولار تغییرات آن را خودش متوجه می‌شود و فقط قسمت‌های لازم از صفحه را دوباره رندر می‌کند.
