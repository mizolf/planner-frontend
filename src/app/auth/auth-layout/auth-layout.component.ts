import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, TranslateModule],
  templateUrl: './auth-layout.component.html',
})
export class AuthLayoutComponent {
  private languageService = inject(LanguageService);
  currentLang = this.languageService.currentLang;

  switchLang(lang: string): void {
    this.languageService.use(lang);
  }
}
