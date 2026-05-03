import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateTripRequest,
  TripDetailErrorKind,
  TripDetailResponse,
  TripResponse,
} from '../models/trip.model';

@Injectable({ providedIn: 'root' })
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
        this._error.set('HOME.ERROR_LOADING_TRIPS');
      },
    });
  }

  createTrip(request: CreateTripRequest): Observable<TripResponse> {
    return this.http.post<TripResponse>(this.apiUrl, request).pipe(
      tap(newTrip => this._trips.update(trips => [newTrip, ...trips])),
    );
  }

  addTrip(trip: TripResponse): void {
    this._trips.update(trips => [trip, ...trips]);
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
  }
}

function mapToErrorKind(status: number): TripDetailErrorKind {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'NO_ACCESS';
    case 404:
      return 'NOT_FOUND';
    default:
      return 'GENERIC';
  }
}
