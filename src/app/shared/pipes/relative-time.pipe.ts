import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'relativeTime',
  standalone: true,
  pure: false,
})
export class RelativeTimePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string): string {
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const locale = this.translate.currentLang || this.translate.defaultLang || 'en';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (diffSeconds < 60) {
      return rtf.format(0, 'second');
    }
    if (diffMinutes < 60) {
      return rtf.format(-diffMinutes, 'minute');
    }
    if (diffHours < 24) {
      return rtf.format(-diffHours, 'hour');
    }
    if (diffDays < 7) {
      return rtf.format(-diffDays, 'day');
    }

    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  }
}
