import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, of, retry, tap, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  CreateInviteRequest,
  InviteErrorCode,
  InviteStatus,
  MyInviteResponse,
  TripInviteResponse,
} from "../models/invite.model";

@Injectable({ providedIn: "root" })
export class InviteService {
  private http = inject(HttpClient);
  private readonly baseTripsUrl = `${environment.apiUrl}/trips`;
  private readonly baseMyUrl = `${environment.apiUrl}/me/invites`;

  private readonly _myPendingInvites = signal<MyInviteResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly myPendingInvites = this._myPendingInvites.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingCount = computed(() => this._myPendingInvites().length);

  loadMyInvites(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<MyInviteResponse[]>(this.baseMyUrl).subscribe({
      next: (invites) => {
        this._myPendingInvites.set(invites);
        this._loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this._loading.set(false);
        this._error.set(this.mapToErrorKind(err));
      },
    });
  }

  acceptInvite(inviteId: number): Observable<void> {
    return this.http
      .post<void>(`${this.baseMyUrl}/${inviteId}/accept`, null)
      .pipe(
        retry({
          count: 1,
          delay: (err) =>
            err instanceof HttpErrorResponse &&
            err.status === 409 &&
            err.error?.code === "CONCURRENT_MODIFICATION"
              ? of(0)
              : throwError(() => err),
        }),
        tap(() => this.removeFromLocal(inviteId)),
      );
  }

  declineInvite(inviteId: number): Observable<void> {
    return this.http
      .post<void>(`${this.baseMyUrl}/${inviteId}/decline`, null)
      .pipe(tap(() => this.removeFromLocal(inviteId)));
  }

  createInvite(
    tripId: number,
    request: CreateInviteRequest,
  ): Observable<TripInviteResponse> {
    return this.http.post<TripInviteResponse>(
      `${this.baseTripsUrl}/${tripId}/invites`,
      request,
    );
  }

  listTripInvites(
    tripId: number,
    status: InviteStatus = "PENDING",
  ): Observable<TripInviteResponse[]> {
    return this.http.get<TripInviteResponse[]>(
      `${this.baseTripsUrl}/${tripId}/invites?status=${status}`,
    );
  }

  cancelInvite(tripId: number, inviteId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseTripsUrl}/${tripId}/invites/${inviteId}`,
    );
  }

  mapToErrorKind(err: HttpErrorResponse): string {
    if (err.status === 409) {
      const code = err.error?.code as InviteErrorCode | undefined;
      switch (code) {
        case "SELF_INVITE":
          return "INVITES.ERRORS.SELF_INVITE";
        case "ALREADY_MEMBER":
          return "INVITES.ERRORS.ALREADY_MEMBER";
        case "INVITE_NOT_PENDING":
          return "INVITES.ERRORS.NOT_PENDING";
        case "INVITE_EXPIRED":
          return "INVITES.ERRORS.EXPIRED";
        case "CONCURRENT_MODIFICATION":
          return "INVITES.ERRORS.RETRY";
        default:
          return "INVITES.ERRORS.GENERIC";
      }
    }

    switch (err.status) {
      case 400:
        return "INVITES.ERRORS.VALIDATION";
      case 403:
        return "INVITES.ERRORS.NO_PERMISSION";
      case 404:
        return "INVITES.ERRORS.NOT_FOUND";
      default:
        return "INVITES.ERRORS.GENERIC";
    }
  }

  private removeFromLocal(inviteId: number): void {
    this._myPendingInvites.update((arr) =>
      arr.filter((i) => i.id !== inviteId),
    );
  }
}
