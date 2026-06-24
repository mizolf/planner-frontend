import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/activity.model';
import {
  CloneTripRequest,
  PublicTripDetailResponse,
  PublicTripSummaryResponse,
} from '../models/community.model';
import { TripResponse } from '../models/trip.model';
import { TripService } from './trip.service';

const PAGE_SIZE = 12;

@Injectable({ providedIn: 'root' })
export class PublicTripsService {
  private http = inject(HttpClient);
  private tripService = inject(TripService);
  private readonly apiUrl = `${environment.apiUrl}/trips`;

  // --- Paginated public list (numbered pagination; current page only) ---
  private readonly _trips = signal<PublicTripSummaryResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _page = signal(0);
  private readonly _totalPages = signal(0);
  // Guard so the tab fetches once on first entry, not on every tab switch.
  private readonly _initialized = signal(false);

  readonly trips = this._trips.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly page = this._page.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  // Latest requested search term; used to discard stale responses.
  private currentSearch = '';

  // --- Detail (for the preview dialog) ---
  private readonly _detail = signal<PublicTripDetailResponse | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _detailError = signal<string | null>(null);

  readonly detail = this._detail.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  readonly detailError = this._detailError.asReadonly();

  // First entry into the tab + every search change (resets to page 0).
  loadFirstPage(search = ''): void {
    this._initialized.set(true);
    this.currentSearch = search;
    this.fetchPage(0);
  }

  // Paginator click.
  goToPage(page: number): void {
    if (this._loading() || page === this._page()) return;
    this.fetchPage(page);
  }

  // Re-fetch the current page (e.g. after a clone-404 removes a trip).
  refresh(): void {
    this.fetchPage(this._page());
  }

  private fetchPage(page: number): void {
    this._loading.set(true);
    this._error.set(null);
    const requestSearch = this.currentSearch;

    let params = new HttpParams()
      .set('page', String(page))
      .set('size', String(PAGE_SIZE));
    if (requestSearch.trim().length > 0) {
      params = params.set('search', requestSearch.trim());
    }

    this.http
      .get<PageResponse<PublicTripSummaryResponse>>(`${this.apiUrl}/public`, { params })
      .subscribe({
        next: (p) => {
          // Drop a response whose search term is no longer the active one.
          if (requestSearch !== this.currentSearch) return;
          this._trips.set(p.content);
          this._page.set(p.number);
          this._totalPages.set(p.totalPages);
          this._loading.set(false);
        },
        error: () => {
          if (requestSearch !== this.currentSearch) return;
          this._loading.set(false);
          this._error.set('EXPLORE.COMMUNITY.ERROR_LOADING');
        },
      });
  }

  loadPublicTrip(id: number): void {
    this._detail.set(null);
    this._detailError.set(null);
    this._detailLoading.set(true);

    this.http.get<PublicTripDetailResponse>(`${this.apiUrl}/public/${id}`).subscribe({
      next: (detail) => {
        this._detail.set(detail);
        this._detailLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this._detailLoading.set(false);
        this._detailError.set(
          err.status === 404
            ? 'EXPLORE.COMMUNITY.ERROR_NOT_FOUND'
            : 'EXPLORE.COMMUNITY.ERROR_LOADING',
        );
      },
    });
  }

  clearDetail(): void {
    this._detail.set(null);
    this._detailError.set(null);
    this._detailLoading.set(false);
  }

  // Same sink as applyTemplate: prepend the new private trip to TripService.
  clone(id: number, body: CloneTripRequest): Observable<TripResponse> {
    return this.http
      .post<TripResponse>(`${this.apiUrl}/${id}/clone`, body)
      .pipe(tap((trip) => this.tripService.addTrip(trip)));
  }
}
