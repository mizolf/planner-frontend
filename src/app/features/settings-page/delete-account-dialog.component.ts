import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../auth/services/auth.service';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { BodyScrollLockService } from '../../shared/services/body-scroll-lock.service';

@Component({
  selector: 'app-delete-account-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, PasswordFieldComponent],
  templateUrl: './delete-account-dialog.component.html',
})
export class DeleteAccountDialogComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(): void {
    this.form.reset();
    this.errorMessage.set(null);
    this.isOpen.set(true);
    this.bodyScrollLock.lock();
  }

  close(): void {
    if (this.loading()) return;
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bodyScrollLock.unlock();
    this.errorMessage.set(null);
  }

  ngOnDestroy(): void {
    // A 401 mid-request force-logs-out and destroys the page while the dialog
    // is still open; release the lock so the login page can scroll.
    if (this.isOpen()) this.bodyScrollLock.unlock();
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService.deleteAccount(this.form.getRawValue().password).subscribe({
      next: () => {
        // The token is already blacklisted server-side — local cleanup only,
        // no POST /auth/logout.
        this.isOpen.set(false);
        this.bodyScrollLock.unlock();
        this.userService.clearCurrentUser();
        this.authService.forceLogout();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400 && err.error?.code === 'INVALID_CURRENT_PASSWORD') {
          const ctrl = this.form.get('password');
          ctrl?.setErrors({ serverError: true });
          ctrl?.markAsTouched();
        } else {
          this.errorMessage.set('SETTINGS.DELETE_ACCOUNT.ERROR_GENERIC');
        }
      },
    });
  }
}
