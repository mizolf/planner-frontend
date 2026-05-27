import {
  Component,
  HostListener,
  inject,
  output,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";

import { FormFieldComponent } from "../../../shared/components/form-field/form-field.component";
import { InviteService } from "../../../core/services/invite.service";
import {
  CreateInviteRequest,
  InviteErrorCode,
  TripInviteResponse,
} from "../../../core/models/invite.model";
import { ToastService } from "../../../shared/services/toast.service";

@Component({
  selector: "app-invite-member-dialog",
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, FormFieldComponent],
  templateUrl: "./invite-member-dialog.component.html",
})
export class InviteMemberDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly inviteService = inject(InviteService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly invited = output<TripInviteResponse>();

  readonly form = this.fb.nonNullable.group({
    email: [
      "",
      [Validators.required, Validators.email, Validators.maxLength(255)],
    ],
    role: this.fb.nonNullable.control<"EDITOR" | "VIEWER">("EDITOR", {
      validators: [Validators.required],
    }),
  });

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number): void {
    this._tripId.set(tripId);
    this.form.reset({ email: "", role: "EDITOR" });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    document.body.style.overflow = "hidden";
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this.isOpen.set(false);
    this.errorMessage.set(null);
    document.body.style.overflow = "";
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const tripId = this._tripId();
    if (tripId === null) return;

    const v = this.form.getRawValue();
    const request: CreateInviteRequest = {
      email: v.email.trim(),
      role: v.role,
    };

    this.loading.set(true);
    this.errorMessage.set(null);

    this.inviteService.createInvite(tripId, request).subscribe({
      next: (created) => {
        this.loading.set(false);
        this.toastService.show({
          message: "INVITES.SUCCESS.SENT",
          type: "success",
        });
        this.invited.emit(created);
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.applyError(err);
      },
    });
  }

  private applyError(err: HttpErrorResponse): void {
    const code = err.error?.code as InviteErrorCode | undefined;
    const emailCtrl = this.form.controls.email;

    if (err.status === 404) {
      emailCtrl.setErrors({ serverNotFound: true });
      emailCtrl.markAsTouched();
      return;
    }

    if (err.status === 409) {
      if (code === "SELF_INVITE") {
        emailCtrl.setErrors({ serverSelfInvite: true });
        emailCtrl.markAsTouched();
        return;
      }
      if (code === "ALREADY_MEMBER") {
        emailCtrl.setErrors({ serverAlreadyMember: true });
        emailCtrl.markAsTouched();
        return;
      }
    }

    if (err.status === 400 && err.error?.fieldErrors?.["email"]) {
      emailCtrl.setErrors({ serverValidation: true });
      emailCtrl.markAsTouched();
      return;
    }

    this.errorMessage.set(this.inviteService.mapToErrorKind(err));
  }
}
