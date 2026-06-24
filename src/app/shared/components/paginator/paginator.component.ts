import { Component, computed, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

// Windowed numbered paginator. `page` is 0-based; `pageChange` emits 0-based.
// Renders nothing when there is a single page.
@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './paginator.component.html',
})
export class PaginatorComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  readonly isFirst = computed(() => this.page() <= 0);
  readonly isLast = computed(() => this.page() >= this.totalPages() - 1);

  // Visible page slots: always first + last + current neighbours, gaps elsewhere.
  readonly slots = computed<(number | 'gap')[]>(() => {
    const total = this.totalPages();
    const cur = this.page();
    if (total <= 1) return [];

    const shown = new Set<number>([0, total - 1]);
    for (let i = cur - 1; i <= cur + 1; i++) {
      if (i >= 0 && i < total) shown.add(i);
    }

    const sorted = [...shown].sort((a, b) => a - b);
    const result: (number | 'gap')[] = [];
    let prev = -1;
    for (const n of sorted) {
      if (prev !== -1 && n - prev > 1) result.push('gap');
      result.push(n);
      prev = n;
    }
    return result;
  });

  go(page: number): void {
    if (page < 0 || page > this.totalPages() - 1 || page === this.page()) return;
    this.pageChange.emit(page);
  }

  prev(): void {
    if (!this.isFirst()) this.pageChange.emit(this.page() - 1);
  }

  next(): void {
    if (!this.isLast()) this.pageChange.emit(this.page() + 1);
  }
}
