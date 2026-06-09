import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const STORAGE_KEY = 'lang';
const DEFAULT_LANG = 'en';
const SUPPORTED = ['en', 'hr'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);

  private readonly _currentLang = signal(DEFAULT_LANG);
  readonly currentLang = this._currentLang.asReadonly();

  /** Restore the persisted language at app startup, falling back to the default. */
  init(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    const lang = stored && SUPPORTED.includes(stored) ? stored : DEFAULT_LANG;
    this.use(lang);
  }

  /** Set the active language, apply it to ngx-translate, and persist the choice. */
  use(lang: string): void {
    this._currentLang.set(lang);
    this.translate.use(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }
}
