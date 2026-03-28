import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../core/services/user.service';
import { AuthService } from '../auth/services/auth.service';
import { User } from '../core/models/user.model';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  user = signal<User | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set('HOME.ERROR_LOADING_USER');
      },
    });
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      error: () => this.authService.forceLogout(),
    });
  }
}
