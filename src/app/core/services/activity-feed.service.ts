import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DashboardActivityItem, PageResponse } from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivityFeedService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/activity-feed`;

  private readonly _activities = signal<DashboardActivityItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly activities = this._activities.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadRecentActivities(size = 20): void {
    this._loading.set(true);
    this._error.set(null);

    const params = new HttpParams().set('page', '0').set('size', String(size));

    this.http.get<PageResponse<DashboardActivityItem>>(this.apiUrl, { params }).subscribe({
      next: (page) => {
        this._activities.set(page.content);
        this._loading.set(false);
      },
      error: () => {
        this._activities.set([]);
        this._loading.set(false);
        this._error.set('ACTIVITY_FEED.ERROR_LOADING');
      },
    });
  }
}
