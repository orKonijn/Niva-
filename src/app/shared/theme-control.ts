import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Theme } from '../core/theme';
@Component({
  selector: 'niva-theme-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-control.html',
})
export class ThemeControl {
  readonly theme = inject(Theme);
  private readonly names = { system: 'לפי המערכת', light: 'בהיר', dark: 'כהה' };
  readonly next = computed(() =>
    this.theme.preference() === 'system'
      ? 'light'
      : this.theme.preference() === 'light'
        ? 'dark'
        : 'system',
  );
  readonly label = computed(
    () => `ערכת נושא: ${this.names[this.theme.preference()]}. מעבר למצב ${this.names[this.next()]}`,
  );
  cycle(): void {
    this.theme.select(this.next());
  }
}
