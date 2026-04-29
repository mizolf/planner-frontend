import { Component, HostListener, inject, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../../core/services/explore.service';
import { TripTemplateSummaryResponse } from '../../../core/models/explore.model';
import { BodyScrollLockService } from '../../../shared/services/body-scroll-lock.service';

@Component({
  selector: 'app-style-preview-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './style-preview-dialog.component.html',
})
export class StylePreviewDialogComponent {
  private exploreService = inject(ExploreService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly style = this.exploreService.currentStyle;
  readonly loading = this.exploreService.currentStyleLoading;
  readonly error = this.exploreService.currentStyleError;

  private currentSlug: string | null = null;

  readonly templateSelected = output<{ styleSlug: string; template: TripTemplateSummaryResponse }>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(styleSlug: string): void {
    this.currentSlug = styleSlug;
    this.exploreService.loadStyle(styleSlug);
    this.isOpen.set(true);
    this.bodyScrollLock.lock();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bodyScrollLock.unlock();
    this.exploreService.clearCurrentStyle();
    this.currentSlug = null;
  }

  retry(): void {
    if (this.currentSlug) {
      this.exploreService.loadStyle(this.currentSlug);
    }
  }

  onTemplateClick(template: TripTemplateSummaryResponse): void {
    if (!this.currentSlug) return;
    this.templateSelected.emit({ styleSlug: this.currentSlug, template });
  }

  seasonKey(season: string): string {
    return `EXPLORE.SEASON.${season}`;
  }
}
