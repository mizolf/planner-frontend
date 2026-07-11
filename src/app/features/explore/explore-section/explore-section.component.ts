import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../../core/services/explore.service';
import {
  TripStyleResponse,
  TripTemplateDetailResponse,
  TripTemplateSummaryResponse,
} from '../../../core/models/explore.model';
import { TripResponse } from '../../../core/models/trip.model';
import { ToastService } from '../../../shared/services/toast.service';
import { StyleCardComponent } from '../style-card/style-card.component';
import { StylePreviewDialogComponent } from '../style-preview-dialog/style-preview-dialog.component';
import { TemplatePreviewDialogComponent } from '../template-preview-dialog/template-preview-dialog.component';
import { ApplyTemplateDialogComponent } from '../apply-template-dialog/apply-template-dialog.component';

@Component({
  selector: 'app-explore-section',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    StyleCardComponent,
    StylePreviewDialogComponent,
    TemplatePreviewDialogComponent,
    ApplyTemplateDialogComponent,
  ],
  templateUrl: './explore-section.component.html',
})
export class ExploreSectionComponent implements OnInit {
  private exploreService = inject(ExploreService);
  private toastService = inject(ToastService);

  @ViewChild(StylePreviewDialogComponent) styleDialog!: StylePreviewDialogComponent;
  @ViewChild(TemplatePreviewDialogComponent) templateDialog!: TemplatePreviewDialogComponent;
  @ViewChild(ApplyTemplateDialogComponent) applyDialog!: ApplyTemplateDialogComponent;

  readonly styles = this.exploreService.styles;
  readonly loading = this.exploreService.stylesLoading;
  readonly error = this.exploreService.stylesError;

  ngOnInit(): void {
    if (this.styles().length === 0) {
      this.exploreService.loadStyles();
    }
  }

  retry(): void {
    this.exploreService.loadStyles();
  }

  onStyleClick(style: TripStyleResponse): void {
    this.styleDialog.open(style.slug);
  }

  onTemplateSelected(event: { styleSlug: string; template: TripTemplateSummaryResponse }): void {
    this.templateDialog.open(event.styleSlug, event.template.slug);
  }

  onApplyClicked(event: { styleSlug: string; template: TripTemplateDetailResponse }): void {
    this.applyDialog.open(event.styleSlug, event.template);
  }

  onTripCreated(_trip: TripResponse): void {
    this.templateDialog.close();
    this.styleDialog.close();
    this.toastService.show({ message: 'EXPLORE.APPLY.SUCCESS', type: 'success' });
  }
}
