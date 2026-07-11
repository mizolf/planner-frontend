import { Component, computed, inject, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../../core/services/explore.service';
import { UserService } from '../../../core/services/user.service';
import {
  FeaturedTemplateResponse,
  TripTemplateDetailResponse,
} from '../../../core/models/explore.model';
import { TripResponse } from '../../../core/models/trip.model';
import { ToastService } from '../../../shared/services/toast.service';
import { TemplateCardComponent } from '../template-card/template-card.component';
import { TemplatePreviewDialogComponent } from '../template-preview-dialog/template-preview-dialog.component';
import { ApplyTemplateDialogComponent } from '../apply-template-dialog/apply-template-dialog.component';

@Component({
  selector: 'app-recommended-trips',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    TemplateCardComponent,
    TemplatePreviewDialogComponent,
    ApplyTemplateDialogComponent,
  ],
  templateUrl: './recommended-trips.component.html',
})
export class RecommendedTripsComponent implements OnInit {
  private exploreService = inject(ExploreService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);

  readonly templateDialog = viewChild.required(TemplatePreviewDialogComponent);
  readonly applyDialog = viewChild.required(ApplyTemplateDialogComponent);

  readonly user = this.userService.currentUser;
  readonly hasInterests = computed(() => (this.user()?.preferredInterests?.length ?? 0) > 0);

  readonly templates = this.exploreService.recommendedTemplates;
  readonly loading = this.exploreService.recommendedTemplatesLoading;
  readonly error = this.exploreService.recommendedTemplatesError;

  ngOnInit(): void {
    if (this.hasInterests()) {
      this.exploreService.loadRecommended();
    }
  }

  retry(): void {
    this.exploreService.loadRecommended();
  }

  onTemplateClick(template: FeaturedTemplateResponse): void {
    this.templateDialog().open(template.styleSlug, template.slug);
  }

  onApplyClicked(event: { styleSlug: string; template: TripTemplateDetailResponse }): void {
    this.applyDialog().open(event.styleSlug, event.template);
  }

  onTripCreated(_trip: TripResponse): void {
    this.templateDialog().close();
    this.toastService.show({ message: 'EXPLORE.APPLY.SUCCESS', type: 'success' });
  }
}
