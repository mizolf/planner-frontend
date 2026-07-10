import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './support-page.component.html',
})
export class SupportPageComponent {
  private router = inject(Router);
  private location = inject(Location);

  readonly year = new Date().getFullYear();

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
