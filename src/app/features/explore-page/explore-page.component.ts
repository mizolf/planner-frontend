import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../core/services/explore.service';
import {
  TripStyleResponse,
  TripTemplateDetailResponse,
  TripTemplateSummaryResponse,
} from '../../core/models/explore.model';
import { TripResponse } from '../../core/models/trip.model';
import { ToastService } from '../../shared/services/toast.service';
import { StyleCardComponent } from '../explore/style-card/style-card.component';
import { StylePreviewDialogComponent } from '../explore/style-preview-dialog/style-preview-dialog.component';
import { TemplatePreviewDialogComponent } from '../explore/template-preview-dialog/template-preview-dialog.component';
import { ApplyTemplateDialogComponent } from '../explore/apply-template-dialog/apply-template-dialog.component';

@Component({
  selector: 'app-explore-page',
  standalone: true,
  imports: [
    TranslateModule,
    StyleCardComponent,
    StylePreviewDialogComponent,
    TemplatePreviewDialogComponent,
    ApplyTemplateDialogComponent,
  ],
  templateUrl: './explore-page.component.html',
})
export class ExplorePageComponent implements OnInit {
  private exploreService = inject(ExploreService);
  private toastService = inject(ToastService);

  readonly styleDialog = viewChild.required(StylePreviewDialogComponent);
  readonly templateDialog = viewChild.required(TemplatePreviewDialogComponent);
  readonly applyDialog = viewChild.required(ApplyTemplateDialogComponent);

  // Style list state comes straight from the shared singleton service.
  readonly styles = this.exploreService.styles;
  readonly loading = this.exploreService.stylesLoading;
  readonly error = this.exploreService.stylesError;

  readonly searchTerm = signal('');

  // Client-side filter over the already-loaded style list (name + description).
  readonly filteredStyles = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.styles();
    }
    return this.styles().filter(
      style =>
        style.name.toLowerCase().includes(term) ||
        (style.description?.toLowerCase().includes(term) ?? false),
    );
  });

  ngOnInit(): void {
    // Skip refetch when the home rail already populated the shared service.
    if (this.styles().length === 0) {
      this.exploreService.loadStyles();
    }
  }

  retry(): void {
    this.exploreService.loadStyles();
  }

  onStyleClick(style: TripStyleResponse): void {
    this.styleDialog().open(style.slug);
  }

  onTemplateSelected(event: { styleSlug: string; template: TripTemplateSummaryResponse }): void {
    this.templateDialog().open(event.styleSlug, event.template.slug);
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
    this.styleDialog().close();
    this.toastService.show({ message: 'EXPLORE.APPLY.SUCCESS', type: 'success' });
  }
}
