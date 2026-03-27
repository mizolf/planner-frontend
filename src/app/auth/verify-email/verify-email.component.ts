import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, FormFieldComponent],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  loading = signal(false);
  resendLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  resendCooldown = signal(0);
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  verifyForm = this.fb.nonNullable.group({
    verificationCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  constructor() {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    if (!this.email) {
      this.router.navigate(['/auth/register']);
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  onSubmit(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { verificationCode } = this.verifyForm.getRawValue();
    this.authService.verifyEmail({ email: this.email, verificationCode }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('AUTH.VERIFY.SUCCESS');
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error;
        if (err.status === 400) {
          this.errorMessage.set(body?.message ?? 'AUTH.VERIFY.ERROR_INVALID_CODE');
        } else if (err.status === 404) {
          this.errorMessage.set('AUTH.VERIFY.ERROR_NOT_FOUND');
        } else {
          this.errorMessage.set('AUTH.VERIFY.ERROR_GENERIC');
        }
      },
    });
  }

  onResend(): void {
    if (this.resendCooldown() > 0) return;

    this.resendLoading.set(true);
    this.errorMessage.set(null);

    this.authService.resendCode({ email: this.email }).subscribe({
      next: () => {
        this.resendLoading.set(false);
        this.successMessage.set('AUTH.VERIFY.CODE_RESENT');
        this.startCooldown();
      },
      error: (err: HttpErrorResponse) => {
        this.resendLoading.set(false);
        if (err.status === 409) {
          this.successMessage.set('AUTH.VERIFY.ALREADY_VERIFIED');
          setTimeout(() => this.router.navigate(['/auth/login']), 2000);
        } else if (err.status === 404) {
          this.errorMessage.set('AUTH.VERIFY.ERROR_NOT_FOUND');
        } else {
          this.errorMessage.set('AUTH.VERIFY.ERROR_GENERIC');
        }
      },
    });
  }

  private startCooldown(): void {
    this.resendCooldown.set(60);
    this.cooldownInterval = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        clearInterval(this.cooldownInterval!);
        this.cooldownInterval = null;
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }
}
