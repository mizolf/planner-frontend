import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';
import { Interest } from '../../core/models/trip.model';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';
import { InterestChipsComponent } from '../../shared/components/interest-chips/interest-chips.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    PasswordFieldComponent,
    InterestChipsComponent,
    DeleteAccountDialogComponent,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private location = inject(Location);

  passwordLoading = signal(false);
  passwordError = signal<string | null>(null);

  preferencesLoading = signal(false);
  preferencesError = signal<string | null>(null);

  private readonly deleteAccountDialog = viewChild(DeleteAccountDialogComponent);

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/profile']);
    }
  }

  passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatchValidator] },
  );

  preferencesForm = this.fb.nonNullable.group({
    interests: [[] as Interest[]],
  });

  ngOnInit(): void {
    // currentUser is loaded globally by the dashboard layout; on a normal
    // navigation it's already there, but on a hard refresh of /settings the
    // layout's HTTP call may still be in flight, so fall back to a fetch.
    const user = this.userService.currentUser();
    if (user) {
      this.preferencesForm.patchValue({ interests: user.preferredInterests ?? [] });
    } else {
      this.userService.getCurrentUser().subscribe((u) =>
        this.preferencesForm.patchValue({ interests: u.preferredInterests ?? [] }),
      );
    }
  }

  passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordsMismatch: true };
    }
    return null;
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordLoading.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.userService.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.passwordLoading.set(false);
        this.passwordForm.reset();
        this.toastService.show({ message: 'SETTINGS.PASSWORD.SUCCESS', type: 'success' });
      },
      error: (err: HttpErrorResponse) => {
        this.passwordLoading.set(false);
        if (err.status === 400 && err.error?.code === 'INVALID_CURRENT_PASSWORD') {
          const ctrl = this.passwordForm.get('currentPassword');
          ctrl?.setErrors({ serverError: true });
          ctrl?.markAsTouched();
        } else {
          this.passwordError.set('SETTINGS.PASSWORD.ERROR_GENERIC');
        }
      },
    });
  }

  openDeleteAccountDialog(): void {
    this.deleteAccountDialog()?.open();
  }

  onSavePreferences(): void {
    this.preferencesLoading.set(true);
    this.preferencesError.set(null);

    const { interests } = this.preferencesForm.getRawValue();
    this.userService.updatePreferences({ interests }).subscribe({
      next: () => {
        this.preferencesLoading.set(false);
        this.preferencesForm.markAsPristine();
        this.toastService.show({ message: 'SETTINGS.PREFERENCES.SUCCESS', type: 'success' });
      },
      error: () => {
        this.preferencesLoading.set(false);
        this.preferencesError.set('SETTINGS.PREFERENCES.ERROR_GENERIC');
      },
    });
  }
}
