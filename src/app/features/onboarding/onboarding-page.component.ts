import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../shared/services/toast.service';
import { Interest } from '../../core/models/trip.model';
import { InterestChipsComponent } from '../../shared/components/interest-chips/interest-chips.component';

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, InterestChipsComponent],
  templateUrl: './onboarding-page.component.html',
})
export class OnboardingPageComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.nonNullable.group({
    interests: [[] as Interest[]],
  });

  private interests = toSignal(this.form.controls.interests.valueChanges, {
    initialValue: this.form.controls.interests.value,
  });

  // Continue requires at least one interest; Skip is always available.
  canContinue = computed(() => this.interests().length > 0);

  onContinue(): void {
    if (!this.canContinue() || this.loading()) return;
    this.loading.set(true);

    const { interests } = this.form.getRawValue();
    this.userService
      .updatePreferences({ interests })
      .pipe(switchMap(() => this.userService.completeOnboarding()))
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: () => this.onError(),
      });
  }

  onSkip(): void {
    if (this.loading()) return;
    this.loading.set(true);

    this.userService.completeOnboarding().subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.onError(),
    });
  }

  private onError(): void {
    this.loading.set(false);
    this.toastService.show({ message: 'ONBOARDING.ERROR', type: 'error' });
  }
}
