import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTripRequest, TripResponse } from '../models/trip.model';

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
}
