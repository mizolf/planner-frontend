import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type: 'success' | 'error';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toast = signal<Toast | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly toast = this._toast.asReadonly();

  show(toast: Toast): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this._toast.set(toast);
    this.timeoutId = setTimeout(() => {
      this._toast.set(null);
      this.timeoutId = null;
    }, toast.duration ?? 3000);
  }
}
