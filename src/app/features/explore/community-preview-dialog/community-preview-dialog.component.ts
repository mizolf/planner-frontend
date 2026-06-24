import { Component, HostListener, inject, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PublicTripsService } from '../../../core/services/public-trips.service';
import { PublicTripDetailResponse } from '../../../core/models/community.model';
import { BodyScrollLockService } from '../../../shared/services/body-scroll-lock.service';
import { formatTime } from '../../../shared/utils/format-time';
import { initialsOf } from '../../../shared/utils/initials';

@Component({
  selector: 'app-community-preview-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './community-preview-dialog.component.html',
})
export class CommunityPreviewDialogComponent {
  private publicTripsService = inject(PublicTripsService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly detail = this.publicTripsService.detail;
  readonly loading = this.publicTripsService.detailLoading;
  readonly error = this.publicTripsService.detailError;

  private currentId: number | null = null;

  readonly cloneClicked = output<PublicTripDetailResponse>();

  initialsOf = initialsOf;

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(id: number): void {
    this.currentId = id;
    this.publicTripsService.loadPublicTrip(id);
    this.isOpen.set(true);
    this.bodyScrollLock.lock();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bodyScrollLock.unlock();
    this.publicTripsService.clearDetail();
    this.currentId = null;
  }

  retry(): void {
    if (this.currentId !== null) {
      this.publicTripsService.loadPublicTrip(this.currentId);
    }
  }

  onClone(): void {
    const d = this.detail();
    if (!d) return;
    this.cloneClicked.emit(d);
  }

  formatTime(time: string | null): string {
    return formatTime(time);
  }
}
