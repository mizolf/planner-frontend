import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

type LocalizedDateFormat = 'mediumDate' | 'fullDate' | 'shortTime';

const FORMATS: Record<LocalizedDateFormat, Intl.DateTimeFormatOptions> = {
  mediumDate: { year: 'numeric', month: 'short', day: 'numeric' },
  fullDate: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  shortTime: { hour: 'numeric', minute: '2-digit' },
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string, format: LocalizedDateFormat): Intl.DateTimeFormat {
  const key = `${locale}|${format}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, FORMATS[format]);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

@Pipe({
  name: 'localizedDate',
  standalone: true,
  pure: false,
})
export class LocalizedDatePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string | Date | null | undefined, format: LocalizedDateFormat = 'mediumDate'): string {
    if (value == null) {
      return '';
    }

    let date: Date;
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
      // Parse date-only strings in local time; new Date('yyyy-MM-dd') would use UTC
      const [year, month, day] = value.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = value instanceof Date ? value : new Date(value);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const locale = this.translate.getCurrentLang() || this.translate.getFallbackLang() || 'en';
    return getFormatter(locale, format).format(date);
  }
}
