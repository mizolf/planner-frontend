import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { InviteService } from '../../../core/services/invite.service';
import { LanguageService } from '../../../core/services/language.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private inviteService = inject(InviteService);
  private languageService = inject(LanguageService);

  user = this.userService.currentUser;
  pendingCount = this.inviteService.pendingCount;
  currentLang = this.languageService.currentLang;
  profileOpen = signal(false);
  mobileOpen = signal(false);

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }

  setLang(lang: string): void {
    this.languageService.use(lang);
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  onLogout(): void {
    this.closeProfile();
    this.authService.logout().subscribe({
      error: () => this.authService.forceLogout(),
    });
  }

  getInitials(): string {
    const name = this.user()?.fullName;
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
