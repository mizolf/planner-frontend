import { Component, HostListener, inject, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../../core/services/explore.service';
import { TripTemplateDetailResponse } from '../../../core/models/explore.model';
import { BodyScrollLockService } from '../../../shared/services/body-scroll-lock.service';

@Component({
  selector: 'app-template-preview-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './template-preview-dialog.component.html',
})
export class TemplatePreviewDialogComponent {
  private exploreService = inject(ExploreService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly template = this.exploreService.currentTemplate;
  readonly loading = this.exploreService.currentTemplateLoading;
  readonly error = this.exploreService.currentTemplateError;

  private currentStyleSlug: string | null = null;
  private currentTemplateSlug: string | null = null;

  readonly applyClicked = output<{
    styleSlug: string;
    template: TripTemplateDetailResponse;
  }>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(styleSlug: string, templateSlug: string): void {
    this.currentStyleSlug = styleSlug;
    this.currentTemplateSlug = templateSlug;
    this.exploreService.loadTemplate(styleSlug, templateSlug);
    this.isOpen.set(true);
    this.bodyScrollLock.lock();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bodyScrollLock.unlock();
    this.exploreService.clearCurrentTemplate();
    this.currentStyleSlug = null;
    this.currentTemplateSlug = null;
  }

  retry(): void {
    if (this.currentStyleSlug && this.currentTemplateSlug) {
      this.exploreService.loadTemplate(this.currentStyleSlug, this.currentTemplateSlug);
    }
  }

  onApply(): void {
    const tpl = this.template();
    if (!tpl || !this.currentStyleSlug) return;
    this.applyClicked.emit({ styleSlug: this.currentStyleSlug, template: tpl });
  }

  seasonKey(season: string): string {
    return `EXPLORE.SEASON.${season}`;
  }

  formatTime(time: string | null): string {
    if (!time) return '';
    return time.slice(0, 5);
  }
}
