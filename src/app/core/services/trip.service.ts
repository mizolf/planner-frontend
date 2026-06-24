import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  CreateTripDayRequest,
  CreateTripRequest,
  TripDayResponse,
  TripDetailErrorKind,
  TripDetailResponse,
  TripMemberResponse,
  TripResponse,
  CreateTripActivityRequest,
  TripActivityResponse,
  UpdateTripActivityRequest,
  UpdateTripDayRequest,
  UpdateTripRequest,
  MemberRole,
  TripVisibility,
} from "../models/trip.model";

@Injectable({ providedIn: "root" })
export class TripService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/trips`;

  private readonly _trips = signal<TripResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly trips = this._trips.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  private readonly _tripDetail = signal<TripDetailResponse | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<TripDetailErrorKind | null>(null);

  readonly tripDetail = this._tripDetail.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  // True while the AI itinerary is being generated for the open trip detail.
  private readonly _generating = signal(false);
  readonly generating = this._generating.asReadonly();

  loadTrips(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<TripResponse[]>(this.apiUrl).subscribe({
      next: (trips) => {
        this._trips.set(trips);
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
        this._error.set("HOME.ERROR_LOADING_TRIPS");
      },
    });
  }

  createTrip(request: CreateTripRequest): Observable<TripResponse> {
    return this.http
      .post<TripResponse>(this.apiUrl, request)
      .pipe(
        tap((newTrip) => this._trips.update((trips) => [newTrip, ...trips])),
      );
  }

  addTrip(trip: TripResponse): void {
    this._trips.update((trips) => [trip, ...trips]);
  }

  updateTrip(
    tripId: number,
    request: UpdateTripRequest,
  ): Observable<TripResponse> {
    return this.http
      .put<TripResponse>(`${this.apiUrl}/${tripId}`, request)
      .pipe(
        tap((updated) => {
          this._tripDetail.update((detail) =>
            detail ? { ...detail, ...updated } : detail,
          );
          this._trips.update((trips) =>
            trips.map((t) => (t.id === tripId ? { ...t, ...updated } : t)),
          );
        }),
      );
  }

  // Owner-only PUBLIC/PRIVATE toggle. Server-confirmed (privacy control — never
  // optimistic); patches visibility into both the open detail and the list.
  setVisibility(
    tripId: number,
    visibility: TripVisibility,
  ): Observable<TripResponse> {
    return this.http
      .patch<TripResponse>(`${this.apiUrl}/${tripId}/visibility`, { visibility })
      .pipe(
        tap((updated) => {
          this._tripDetail.update((detail) =>
            detail ? { ...detail, visibility: updated.visibility } : detail,
          );
          this._trips.update((trips) =>
            trips.map((t) =>
              t.id === tripId ? { ...t, visibility: updated.visibility } : t,
            ),
          );
        }),
      );
  }

  deleteTrip(tripId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${tripId}`)
      .pipe(
        tap(() => {
          this._trips.update((trips) => trips.filter((t) => t.id !== tripId));
          this.clearTripDetail();
        }),
      );
  }

  leaveTrip(tripId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${tripId}/members/me`)
      .pipe(
        tap(() => {
          this._trips.update((trips) => trips.filter((t) => t.id !== tripId));
          this.clearTripDetail();
        }),
      );
  }

  updateMemberRole(
    tripId: number,
    userId: number,
    role: MemberRole,
  ): Observable<TripMemberResponse> {
    return this.http
      .put<TripMemberResponse>(`${this.apiUrl}/${tripId}/members/${userId}`, {
        role,
      })
      .pipe(
        tap((updatedMember) => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            return {
              ...detail,
              members: detail.members.map((m) =>
                m.userId === userId ? updatedMember : m,
              ),
            };
          });
        }),
      );
  }

  removeMember(tripId: number, userId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${tripId}/members/${userId}`)
      .pipe(
        tap(() => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            return {
              ...detail,
              members: detail.members.filter((m) => m.userId !== userId),
            };
          });
        }),
      );
  }

  loadTripDetail(id: number): void {
    this._detailLoading.set(true);
    this._detailError.set(null);
    this._tripDetail.set(null);

    this.http.get<TripDetailResponse>(`${this.apiUrl}/${id}`).subscribe({
      next: (detail) => {
        this._tripDetail.set(detail);
        this._detailLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this._detailLoading.set(false);
        this._detailError.set(mapToErrorKind(err.status));
      },
    });
  }

  clearTripDetail(): void {
    this._tripDetail.set(null);
    this._detailError.set(null);
    this._detailLoading.set(false);
    this._generating.set(false);
  }

  // Triggers backend AI generation for an (empty) trip. Empty body — the
  // backend derives all context from the trip itself. On success it writes the
  // full TripDetailResponse into _tripDetail so the detail page fills in.
  generateItinerary(tripId: number): Observable<TripDetailResponse> {
    this._generating.set(true);

    return this.http
      .post<TripDetailResponse>(
        `${this.apiUrl}/${tripId}/generate-itinerary`,
        {},
      )
      .pipe(
        tap({
          next: (detail) => {
            this._tripDetail.set(detail);
            this._generating.set(false);
          },
          error: () => this._generating.set(false),
        }),
      );
  }

  addDayToTrip(
    tripId: number,
    request: CreateTripDayRequest,
  ): Observable<TripDayResponse> {
    return this.http
      .post<TripDayResponse>(`${this.apiUrl}/${tripId}/days`, request)
      .pipe(
        tap((newDay) => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            const days = [...detail.days, newDay].sort(
              (a, b) => a.dayNumber - b.dayNumber,
            );
            return { ...detail, days };
          });
        }),
      );
  }

  addActivityToDay(
    tripId: number,
    dayId: number,
    request: CreateTripActivityRequest,
  ): Observable<TripActivityResponse> {
    return this.http
      .post<TripActivityResponse>(
        `${this.apiUrl}/${tripId}/days/${dayId}/activities`,
        request,
      )
      .pipe(
        tap((newActivity) => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            return {
              ...detail,
              days: detail.days.map((d) => {
                if (d.id !== dayId) return d;
                return {
                  ...d,
                  activities: [...d.activities, newActivity].sort(
                    compareByStartTime,
                  ),
                };
              }),
            };
          });
        }),
      );
  }

  updateActivityInDay(
    tripId: number, dayId: number, activityId: number, request: UpdateTripActivityRequest): Observable<TripActivityResponse> {
    return this.http.put<TripActivityResponse>(
      `${this.apiUrl}/${tripId}/days/${dayId}/activities/${activityId}`,
      request
    ).pipe(
      tap((updatedActivity)=>{
        this._tripDetail.update((detail) => {
          if (!detail) return detail;
          return {
            ...detail,
            days: detail.days.map((d) => {
              if (d.id !== dayId) return d;
              return {
                ...d,
                activities: d.activities.map(a => a.id === activityId ? updatedActivity : a).sort(
                  compareByStartTime,
                ),
              };
            }),
          };
        });
      })
    );
  }

  updateDay(
    tripId: number,
    dayId: number,
    request: UpdateTripDayRequest,
  ): Observable<TripDayResponse> {
    return this.http
      .put<TripDayResponse>(`${this.apiUrl}/${tripId}/days/${dayId}`, request)
      .pipe(
        tap((updatedDay) => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            const days = detail.days
              .map((d) => (d.id === dayId ? updatedDay : d))
              .sort((a, b) => a.dayNumber - b.dayNumber);
            return { ...detail, days };
          });
        }),
      );
  }

  deleteActivityFromDay(tripId: number, dayId: number, activityId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${tripId}/days/${dayId}/activities/${activityId}`)
    .pipe(
      tap(() => {
        this._tripDetail.update((detail) => {
          if (!detail) return detail;
          return {
            ...detail,
            days: detail.days.map((d) => {
              if (d.id !== dayId) return d;
              return {
                ...d,
                activities: d.activities.filter(a => a.id !== activityId),
              };
            }),
          };
        });
      })
    );
  }

  deleteDayFromTrip(tripId: number, dayId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${tripId}/days/${dayId}`)
      .pipe(
        tap(() => {
          this._tripDetail.update((detail) => {
            if (!detail) return detail;
            return {
              ...detail,
              days: detail.days.filter((d) => d.id !== dayId),
            };
          });
        }),
      );
  }
}

function compareByStartTime(
  a: TripActivityResponse,
  b: TripActivityResponse,
): number {
  if (a.startTime == null && b.startTime == null) return a.id - b.id;
  if (a.startTime == null) return 1;
  if (b.startTime == null) return -1;
  return a.startTime.localeCompare(b.startTime) || a.id - b.id;
}

function mapToErrorKind(status: number): TripDetailErrorKind {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "NO_ACCESS";
    case 404:
      return "NOT_FOUND";
    default:
      return "GENERIC";
  }
}
