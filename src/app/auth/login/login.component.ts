import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, FormFieldComponent, PasswordFieldComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();
    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);

        if (err.status === 401) {
          this.errorMessage.set('AUTH.LOGIN.ERROR_WRONG_PASSWORD');
        } else if (err.status === 403) {
          // Account not verified — redirect to verify page with email pre-filled
          this.router.navigate(['/auth/verify'], { queryParams: { email } });
        } else if (err.status === 404) {
          this.errorMessage.set('AUTH.LOGIN.ERROR_NOT_FOUND');
        } else {
          this.errorMessage.set('AUTH.LOGIN.ERROR_GENERIC');
        }
      },
    });
  }

  onGoogleSignIn(): void {
    this.authService.loginWithGoogle();
  }
}
