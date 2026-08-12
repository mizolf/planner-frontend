import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../services/auth.service';
import { isValidationError } from '../models/auth.models';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { PasswordFieldComponent } from '../../shared/components/password-field/password-field.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, FormFieldComponent, PasswordFieldComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: [this.passwordsMatchValidator] });

  passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordsMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { fullName, email, password } = this.registerForm.getRawValue();
    this.authService.register({ fullName, email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/auth/verify'], { queryParams: { email } });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error;

        if (err.status === 400 && isValidationError(body)) {
          // Map backend field errors to form controls
          for (const [field, message] of Object.entries(body.fieldErrors)) {
            const control = this.registerForm.get(field);
            if (control) {
              control.setErrors({ serverError: message });
            }
          }
        } else if (err.status === 409) {
          // Backend rejects an already-registered email with EMAIL_ALREADY_IN_USE
          this.errorMessage.set('AUTH.REGISTER.ERROR_DUPLICATE');
        } else {
          this.errorMessage.set('AUTH.REGISTER.ERROR_GENERIC');
        }
      },
    });
  }
}
