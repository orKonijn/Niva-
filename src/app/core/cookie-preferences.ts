import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class CookiePreferences {
  readonly decided = signal(this.read());
  private read(): boolean {
    try {
      return ['necessary', 'all'].includes(localStorage.getItem('niva.cookie-choice') ?? '');
    } catch {
      return false;
    }
  }
  choose(value: 'necessary' | 'all'): void {
    try {
      localStorage.setItem('niva.cookie-choice', value);
    } catch {
      /* This visit still remembers the choice. */
    }
    this.decided.set(true);
  }
  reopen(): void {
    this.decided.set(false);
  }
}
