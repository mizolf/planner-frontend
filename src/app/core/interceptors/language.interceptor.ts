import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../services/language.service';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept API requests — let static assets (translations, images, etc.) through
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const lang = inject(LanguageService).currentLang();
  const clonedReq = req.clone({
    setHeaders: { 'Accept-Language': lang },
  });
  return next(clonedReq);
};
