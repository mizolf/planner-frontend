import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { UserService } from '../services/user.service';
import { InviteService } from '../services/invite.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, TranslateModule, NavbarComponent, ToastComponent],
  templateUrl: './dashboard-layout.component.html',
})
export class DashboardLayoutComponent implements OnInit {
  userService = inject(UserService);
  inviteService = inject(InviteService);

  ngOnInit(): void {
    this.userService.loadCurrentUser();
    this.inviteService.loadMyInvites();
  }
}
