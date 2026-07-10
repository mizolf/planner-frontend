import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Location, NgClass } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../core/services/explore.service';
import { PublicTripsService } from '../../core/services/public-trips.service';
import {
  FeaturedTemplateResponse,
  TripTemplateDetailResponse,
} from '../../core/models/explore.model';
import {
  PublicTripDetailResponse,
  PublicTripSummaryResponse,
} from '../../core/models/community.model';
import { TripResponse } from '../../core/models/trip.model';
import { ToastService } from '../../shared/services/toast.service';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { TemplateCardComponent } from '../explore/template-card/template-card.component';
import { TemplatePreviewDialogComponent } from '../explore/template-preview-dialog/template-preview-dialog.component';
import { ApplyTemplateDialogComponent } from '../explore/apply-template-dialog/apply-template-dialog.component';
import { PublicTripCardComponent } from '../explore/public-trip-card/public-trip-card.component';
import { CommunityPreviewDialogComponent } from '../explore/community-preview-dialog/community-preview-dialog.component';
import { CloneTripDialogComponent } from '../explore/clone-trip-dialog/clone-trip-dialog.component';

type ExploreTab = 'TEMPLATES' | 'COMMUNITY';

const COMMUNITY_SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-explore-page',
  standalone: true,
  imports: [
    NgClass,
    TranslateModule,
    PaginatorComponent,
    TemplateCardComponent,
    TemplatePreviewDialogComponent,
    ApplyTemplateDialogComponent,
    PublicTripCardComponent,
    CommunityPreviewDialogComponent,
    CloneTripDialogComponent,
  ],
  templateUrl: './explore-page.component.html',
})
export class ExplorePageComponent implements OnInit, OnDestroy {
  private exploreService = inject(ExploreService);
  private publicTripsService = inject(PublicTripsService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  readonly templateDialog = viewChild.required(TemplatePreviewDialogComponent);
  readonly applyDialog = viewChild.required(ApplyTemplateDialogComponent);
  readonly communityPreviewDialog = viewChild.required(CommunityPreviewDialogComponent);
  readonly cloneDialog = viewChild.required(CloneTripDialogComponent);
  readonly communityTop = viewChild<ElementRef<HTMLElement>>('communityTop');

  readonly activeTab = signal<ExploreTab>('TEMPLATES');

  // --- Templates (client-side filter, unchanged) ---
  readonly templates = this.exploreService.featuredTemplates;
  readonly loading = this.exploreService.featuredTemplatesLoading;
  readonly error = this.exploreService.featuredTemplatesError;

  // --- Community (server-side pagination) ---
  readonly communityTrips = this.publicTripsService.trips;
  readonly communityLoading = this.publicTripsService.loading;
  readonly communityError = this.publicTripsService.error;
  readonly communityPage = this.publicTripsService.page;
  readonly communityTotalPages = this.publicTripsService.totalPages;

  readonly searchTerm = signal('');

  // Drives community (server-side) reloads off the shared search box, debounced.
  private readonly searchDebounced = toObservable(this.searchTerm).pipe(
    skip(1),
    debounceTime(COMMUNITY_SEARCH_DEBOUNCE_MS),
    distinctUntilChanged(),
  );
  private searchSub?: Subscription;

  // Distinct styles present in the loaded templates (preserve backend order).
  readonly availableStyles = computed(() => {
    const seen = new Set<string>();
    const result: { slug: string; name: string }[] = [];
    for (const t of this.templates()) {
      if (!seen.has(t.styleSlug)) {
        seen.add(t.styleSlug);
        result.push({ slug: t.styleSlug, name: t.styleName });
      }
    }
    return result;
  });

  // Multi-select style filter, keyed by styleSlug. Empty set = show all.
  readonly selectedStyles = signal<ReadonlySet<string>>(new Set());

  // Client-side filter: selected styles (OR) AND search (name + destination + style).
  readonly filteredTemplates = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const styles = this.selectedStyles();
    return this.templates().filter(t => {
      if (styles.size > 0 && !styles.has(t.styleSlug)) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        t.name.toLowerCase().includes(term) ||
        t.destination.toLowerCase().includes(term) ||
        t.styleName.toLowerCase().includes(term)
      );
    });
  });

  // True when the empty community list is the result of a search, not a bare tab.
  readonly hasCommunitySearch = computed(() => this.searchTerm().trim().length > 0);

  ngOnInit(): void {
    if (this.templates().length === 0) {
      this.exploreService.loadFeaturedTemplates();
    }

    // Deep-link: /explore/community lands straight on the Community tab.
    if (this.route.snapshot.data['tab'] === 'COMMUNITY') {
      this.setTab('COMMUNITY');
    }

    // Once Community is initialized, every search change re-queries it (server-side),
    // regardless of the active tab — so switching tabs keeps the list in sync.
    this.searchSub = this.searchDebounced.subscribe(term => {
      if (this.publicTripsService.initialized()) {
        this.publicTripsService.loadFirstPage(term);
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  /** Presentational only: tonal pill classes for the active/inactive tab. */
  tabClasses(tab: ExploreTab): string {
    return this.activeTab() === tab
      ? 'bg-surface-container-lowest text-primary shadow-ambient'
      : 'text-on-surface-variant hover:text-on-surface';
  }

  setTab(tab: ExploreTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.location.replaceState(tab === 'COMMUNITY' ? '/explore/community' : '/explore');
    if (tab === 'COMMUNITY' && !this.publicTripsService.initialized()) {
      this.publicTripsService.loadFirstPage(this.searchTerm());
    }
  }

  retry(): void {
    this.exploreService.loadFeaturedTemplates();
  }

  retryCommunity(): void {
    this.publicTripsService.loadFirstPage(this.searchTerm());
  }

  toggleStyle(slug: string): void {
    const next = new Set(this.selectedStyles());
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    this.selectedStyles.set(next);
  }

  clearStyleFilter(): void {
    this.selectedStyles.set(new Set());
  }

  // --- Templates flow (unchanged) ---
  onTemplateClick(template: FeaturedTemplateResponse): void {
    this.templateDialog().open(template.styleSlug, template.slug);
  }

  onApplyClicked(event: { styleSlug: string; template: TripTemplateDetailResponse }): void {
    this.applyDialog().open({
      styleSlug: event.styleSlug,
      templateSlug: event.template.slug,
      templateName: event.template.name,
      durationDays: event.template.durationDays,
      estimatedBudget: event.template.estimatedBudget,
    });
  }

  onTripCreated(_trip: TripResponse): void {
    this.templateDialog().close();
    this.toastService.show({ message: 'EXPLORE.APPLY.SUCCESS', type: 'success' });
  }

  // --- Community flow ---
  onCommunityCardClick(trip: PublicTripSummaryResponse): void {
    this.communityPreviewDialog().open(trip.id);
  }

  onCloneClicked(detail: PublicTripDetailResponse): void {
    this.cloneDialog().open({
      tripId: detail.id,
      tripName: detail.name,
      durationDays: detail.durationDays,
    });
  }

  onCloneSuccess(_trip: TripResponse): void {
    this.communityPreviewDialog().close();
    this.toastService.show({ message: 'EXPLORE.COMMUNITY.CLONE.SUCCESS', type: 'success' });
  }

  onPageChange(page: number): void {
    this.publicTripsService.goToPage(page);
    this.communityTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
