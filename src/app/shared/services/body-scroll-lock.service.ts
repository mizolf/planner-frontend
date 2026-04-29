import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BodyScrollLockService {
  private count = 0;

  lock(): void {
    if (this.count === 0) {
      document.body.style.overflow = 'hidden';
    }
    this.count++;
  }

  unlock(): void {
    if (this.count <= 0) return;
    this.count--;
    if (this.count === 0) {
      document.body.style.overflow = '';
    }
  }
}
