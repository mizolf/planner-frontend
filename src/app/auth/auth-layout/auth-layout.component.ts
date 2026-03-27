import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, TranslateModule],
  templateUrl: './auth-layout.component.html',
})
export class AuthLayoutComponent {
  private translateService = inject(TranslateService);
  currentLang = 'en';

  constructor() {
    this.translateService.use('en');
  }

  switchLang(lang: string): void {
    this.currentLang = lang;
    this.translateService.use(lang);
  }
}
