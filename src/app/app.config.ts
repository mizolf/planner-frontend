import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { authInterceptor } from './auth/interceptors/auth.interceptor';
import { errorInterceptor } from './auth/interceptors/error.interceptor';
import { languageInterceptor } from './core/interceptors/language.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, languageInterceptor, errorInterceptor])),
    provideTranslateService({ defaultLanguage: 'en' }),
    ...provideTranslateHttpLoader(),
  ]
};
