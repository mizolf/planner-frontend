import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApplyTripTemplateRequest,
  FeaturedTemplateResponse,
  TripStyleDetailResponse,
  TripStyleResponse,
  TripTemplateDetailResponse,
} from '../models/explore.model';
import { TripResponse } from '../models/trip.model';
import { TripService } from './trip.service';

@Injectable({ providedIn: 'root' })
export class ExploreService {
  private http = inject(HttpClient);
  private tripService = inject(TripService);
  private readonly apiUrl = `${environment.apiUrl}/explore`;

  private readonly _styles = signal<TripStyleResponse[]>([]);
  private readonly _stylesLoading = signal(false);
  private readonly _stylesError = signal<string | null>(null);

  private readonly _featuredTemplates = signal<FeaturedTemplateResponse[]>([]);
  private readonly _featuredTemplatesLoading = signal(false);
  private readonly _featuredTemplatesError = signal<string | null>(null);

  private readonly _recommendedTemplates = signal<FeaturedTemplateResponse[]>([]);
  private readonly _recommendedTemplatesLoading = signal(false);
  private readonly _recommendedTemplatesError = signal<string | null>(null);

  private readonly _currentStyle = signal<TripStyleDetailResponse | null>(null);
  private readonly _currentStyleLoading = signal(false);
  private readonly _currentStyleError = signal<string | null>(null);

  private readonly _currentTemplate = signal<TripTemplateDetailResponse | null>(null);
  private readonly _currentTemplateLoading = signal(false);
  private readonly _currentTemplateError = signal<string | null>(null);

  private readonly styleCache = new Map<string, TripStyleDetailResponse>();
  private readonly templateCache = new Map<string, TripTemplateDetailResponse>();

  readonly styles = this._styles.asReadonly();
  readonly stylesLoading = this._stylesLoading.asReadonly();
  readonly stylesError = this._stylesError.asReadonly();

  readonly featuredTemplates = this._featuredTemplates.asReadonly();
  readonly featuredTemplatesLoading = this._featuredTemplatesLoading.asReadonly();
  readonly featuredTemplatesError = this._featuredTemplatesError.asReadonly();

  readonly recommendedTemplates = this._recommendedTemplates.asReadonly();
  readonly recommendedTemplatesLoading = this._recommendedTemplatesLoading.asReadonly();
  readonly recommendedTemplatesError = this._recommendedTemplatesError.asReadonly();

  readonly currentStyle = this._currentStyle.asReadonly();
  readonly currentStyleLoading = this._currentStyleLoading.asReadonly();
  readonly currentStyleError = this._currentStyleError.asReadonly();

  readonly currentTemplate = this._currentTemplate.asReadonly();
  readonly currentTemplateLoading = this._currentTemplateLoading.asReadonly();
  readonly currentTemplateError = this._currentTemplateError.asReadonly();

  loadStyles(): void {
    this._stylesLoading.set(true);
    this._stylesError.set(null);

    this.http.get<TripStyleResponse[]>(`${this.apiUrl}/styles`).subscribe({
      next: (styles) => {
        this._styles.set(styles);
        this._stylesLoading.set(false);
      },
      error: () => {
        this._stylesLoading.set(false);
        this._stylesError.set('EXPLORE.ERROR_LOADING_STYLES');
      },
    });
  }

  loadFeaturedTemplates(): void {
    this._featuredTemplatesLoading.set(true);
    this._featuredTemplatesError.set(null);

    this.http.get<FeaturedTemplateResponse[]>(`${this.apiUrl}/templates`).subscribe({
      next: (templates) => {
        this._featuredTemplates.set(templates);
        this._featuredTemplatesLoading.set(false);
      },
      error: () => {
        this._featuredTemplatesLoading.set(false);
        this._featuredTemplatesError.set('EXPLORE.ERROR_LOADING_TEMPLATES');
      },
    });
  }

  loadRecommended(): void {
    this._recommendedTemplatesLoading.set(true);
    this._recommendedTemplatesError.set(null);

    this.http.get<FeaturedTemplateResponse[]>(`${this.apiUrl}/recommended`).subscribe({
      next: (templates) => {
        this._recommendedTemplates.set(templates);
        this._recommendedTemplatesLoading.set(false);
      },
      error: () => {
        this._recommendedTemplatesLoading.set(false);
        this._recommendedTemplatesError.set('EXPLORE.RECOMMENDED.ERROR');
      },
    });
  }

  loadStyle(styleSlug: string): void {
    this._currentStyleError.set(null);

    const cached = this.styleCache.get(styleSlug);
    if (cached) {
      this._currentStyle.set(cached);
      this._currentStyleLoading.set(false);
      return;
    }

    this._currentStyle.set(null);
    this._currentStyleLoading.set(true);

    this.http.get<TripStyleDetailResponse>(`${this.apiUrl}/styles/${styleSlug}`).subscribe({
      next: (style) => {
        this.styleCache.set(styleSlug, style);
        this._currentStyle.set(style);
        this._currentStyleLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this._currentStyleLoading.set(false);
        this._currentStyleError.set(
          err.status === 404 ? 'EXPLORE.ERROR_STYLE_NOT_FOUND' : 'EXPLORE.ERROR_LOADING_STYLE',
        );
      },
    });
  }

  loadTemplate(styleSlug: string, templateSlug: string): void {
    this._currentTemplateError.set(null);

    const key = `${styleSlug}/${templateSlug}`;
    const cached = this.templateCache.get(key);
    if (cached) {
      this._currentTemplate.set(cached);
      this._currentTemplateLoading.set(false);
      return;
    }

    this._currentTemplate.set(null);
    this._currentTemplateLoading.set(true);

    this.http
      .get<TripTemplateDetailResponse>(`${this.apiUrl}/styles/${styleSlug}/templates/${templateSlug}`)
      .subscribe({
        next: (template) => {
          this.templateCache.set(key, template);
          this._currentTemplate.set(template);
          this._currentTemplateLoading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this._currentTemplateLoading.set(false);
          this._currentTemplateError.set(
            err.status === 404 ? 'EXPLORE.ERROR_TEMPLATE_NOT_FOUND' : 'EXPLORE.ERROR_LOADING_TEMPLATE',
          );
        },
      });
  }

  applyTemplate(
    styleSlug: string,
    templateSlug: string,
    body: ApplyTripTemplateRequest,
  ): Observable<TripResponse> {
    return this.http
      .post<TripResponse>(`${this.apiUrl}/styles/${styleSlug}/templates/${templateSlug}/apply`, body)
      .pipe(
        tap(trip => this.tripService.addTrip(trip)),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.styleCache.delete(styleSlug);
            this.templateCache.delete(`${styleSlug}/${templateSlug}`);
          }
          return throwError(() => err);
        }),
      );
  }

  clearCurrentStyle(): void {
    this._currentStyle.set(null);
    this._currentStyleError.set(null);
  }

  clearCurrentTemplate(): void {
    this._currentTemplate.set(null);
    this._currentTemplateError.set(null);
  }
}
