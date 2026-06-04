import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../core/services/explore.service';
import {
  FeaturedTemplateResponse,
  TripTemplateDetailResponse,
} from '../../core/models/explore.model';
import { TripResponse } from '../../core/models/trip.model';
import { ToastService } from '../../shared/services/toast.service';
import { TemplateCardComponent } from '../explore/template-card/template-card.component';
import { TemplatePreviewDialogComponent } from '../explore/template-preview-dialog/template-preview-dialog.component';
import { ApplyTemplateDialogComponent } from '../explore/apply-template-dialog/apply-template-dialog.component';

@Component({
  selector: 'app-explore-page',
  standalone: true,
  imports: [
    TranslateModule,
    TemplateCardComponent,
    TemplatePreviewDialogComponent,
    ApplyTemplateDialogComponent,
  ],
  templateUrl: './explore-page.component.html',
})
export class ExplorePageComponent implements OnInit {
  private exploreService = inject(ExploreService);
  private toastService = inject(ToastService);

  readonly templateDialog = viewChild.required(TemplatePreviewDialogComponent);
  readonly applyDialog = viewChild.required(ApplyTemplateDialogComponent);

  // Flat template list comes straight from the shared singleton service.
  readonly templates = this.exploreService.featuredTemplates;
  readonly loading = this.exploreService.featuredTemplatesLoading;
  readonly error = this.exploreService.featuredTemplatesError;

  readonly searchTerm = signal('');

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

  ngOnInit(): void {
    if (this.templates().length === 0) {
      this.exploreService.loadFeaturedTemplates();
    }
  }

  retry(): void {
    this.exploreService.loadFeaturedTemplates();
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

  onTemplateClick(template: FeaturedTemplateResponse): void {
    // Each card carries its parent styleSlug, so we deep-link straight into the preview.
    this.templateDialog().open(template.styleSlug, template.slug);
  }

  onApplyClicked(event: { styleSlug: string; template: TripTemplateDetailResponse }): void {
    this.applyDialog().open({
      styleSlug: event.styleSlug,
      templateSlug: event.template.slug,
      templateName: event.template.name,
      durationDays: event.template.durationDays,
    });
  }

  onTripCreated(_trip: TripResponse): void {
    this.templateDialog().close();
    this.toastService.show({ message: 'EXPLORE.APPLY.SUCCESS', type: 'success' });
  }
}
