import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../core/services/user.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  userService = inject(UserService);
}
