import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { AccountSession, safeReturn } from '../core/account-session';
@Component({
  imports: [FormsModule, RouterLink, Brand],
  templateUrl: './auth.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  readonly session = inject(AccountSession);
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly mode = signal(
    this.route.snapshot.data['mode'] as 'login' | 'register' | 'forgot' | 'reset',
  );
  readonly heading = computed(
    () =>
      ({
        login: 'נעים לחזור',
        register: 'יוצרים חשבון ב־Niva',
        forgot: 'איפוס הסיסמה',
        reset: 'בוחרים סיסמה חדשה',
      })[this.mode()],
  );
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  email = '';
  password = '';
  name = '';
  readonly returnTo = safeReturn(this.route.snapshot.queryParamMap.get('returnTo'));
  constructor() {
    if (
      this.route.snapshot.queryParamMap.has('oauth') ||
      this.route.snapshot.queryParamMap.has('error')
    )
      this.error.set('ההתחברות בוטלה או נכשלה. אפשר לנסות שוב או לבחור שיטה אחרת.');
    if (this.route.snapshot.queryParamMap.has('verified'))
      this.message.set('אם האימות הושלם, אפשר להתחבר באמצעות הסיסמה.');
  }
  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const callbackURL = `${location.origin}/login?verified=1`;
      if (this.mode() === 'register') {
        await this.session.auth('sign-up/email', {
          name: this.name.trim(),
          email: this.email.trim(),
          password: this.password,
          callbackURL,
        });
        this.message.set('בדקו את תיבת הדוא״ל להשלמת האימות. עדיין לא נוצר חיבור לחשבון.');
      } else if (this.mode() === 'forgot') {
        await this.session.auth('request-password-reset', {
          email: this.email.trim(),
          redirectTo: `${location.origin}/reset-password`,
        });
        this.message.set('אם הכתובת רשומה, נשלחו הוראות לאיפוס הסיסמה.');
      } else if (this.mode() === 'reset') {
        await this.session.auth('reset-password', {
          newPassword: this.password,
          token: this.route.snapshot.queryParamMap.get('token') ?? '',
        });
        this.message.set('הסיסמה עודכנה. יש להתחבר מחדש.');
      } else {
        await this.session.auth('sign-in/email', {
          email: this.email.trim(),
          password: this.password,
        });
        await this.session.signedIn();
        if (!this.session.user()) throw new Error('EMAIL_NOT_VERIFIED');
        await this.router.navigateByUrl(this.returnTo);
      }
      this.password = '';
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      this.error.set(
        code === 'EMAIL_NOT_VERIFIED'
          ? 'יש לאמת את כתובת הדוא״ל לפני ההתחברות. בדקו את תיבת הדואר.'
          : 'לא ניתן להשלים את הפעולה. בדקו את הפרטים, קישור האימות או האיפוס, והחיבור. לאחר ניסיונות רבים יש להמתין ולנסות שוב.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async social(provider: 'google' | 'apple'): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.session.auth('sign-in/social', {
        provider,
        callbackURL: `${location.origin}${this.returnTo}`,
        errorCallbackURL: `${location.origin}/login?oauth=error`,
      });
      const target = new URL(String(result['url']));
      if (
        target.protocol !== 'https:' ||
        !['accounts.google.com', 'appleid.apple.com'].includes(target.hostname)
      )
        throw new Error();
      location.assign(target.href);
    } catch {
      this.error.set('ההתחברות לספק אינה זמינה כרגע. אפשר לבחור שיטה אחרת.');
      this.busy.set(false);
    }
  }
}
