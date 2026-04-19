import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  private toastService = inject(ToastService);
  readonly toast = this.toastService.toast;
}
