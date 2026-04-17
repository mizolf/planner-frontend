import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent {
  private router = inject(Router);
  private location = inject(Location);

  goHome(): void {
    this.router.navigate(['/home']);
  }

  // TODO: Change to explore/destinations route when implemented
  goExplore(): void {
    this.location.back();
  }
}
