import { Component, OnDestroy, computed, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { validateImageFile } from '../../utils/image-file';

/**
 * Staged cover-image picker for the trip dialogs: picking a file only shows a
 * local preview — the parent reads stagedFile()/removeExisting() on Save and
 * performs the actual upload/delete. No service calls happen here.
 */
@Component({
  selector: 'app-cover-image-picker',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './cover-image-picker.component.html',
})
export class CoverImagePickerComponent implements OnDestroy {
  readonly label = input('TRIPS.DETAIL.IMAGE.LABEL');
  readonly initialUrl = input<string | null>(null);
  readonly disabled = input(false);

  readonly stagedFile = signal<File | null>(null);
  readonly removeExisting = signal(false);
  readonly error = signal<string | null>(null);
  private readonly previewUrl = signal<string | null>(null);

  readonly displayedUrl = computed(
    () => this.previewUrl() ?? (this.removeExisting() ? null : this.initialUrl()),
  );

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = ''; // allow re-picking the same file
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      this.error.set(error);
      return;
    }

    this.error.set(null);
    this.revokePreview();
    this.stagedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.removeExisting.set(false);
  }

  onRemove(): void {
    this.error.set(null);
    if (this.stagedFile()) {
      // Un-stage: back to whatever the trip currently has
      this.revokePreview();
      this.stagedFile.set(null);
    } else if (this.initialUrl()) {
      this.removeExisting.set(true);
    }
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }
}
