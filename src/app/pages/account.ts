import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { AppStore, type ImportPreview } from '../core/app-store';
import { AccountSession } from '../core/account-session';
import { categoryLabel, districtLabel, workStylesLabel } from '../core/preferences';
@Component({
  imports: [FormsModule, RouterLink, Brand],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  readonly store = inject(AppStore);
  readonly session = inject(AccountSession);
  readonly router = inject(Router);
  readonly methods = signal<string[]>([]);
  readonly preview = signal<ImportPreview | null>(null);
  readonly message = signal('');
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  readonly linking = signal(false);
  readonly categoryLabel = categoryLabel;
  readonly districtLabel = districtLabel;
  readonly workStylesLabel = workStylesLabel;
  constructor() {
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('oauth'))
      this.error.set('קישור שיטת ההתחברות בוטל או נכשל. לא נוספה שיטה חדשה.');
    void this.loadMethods();
  }
  async loadMethods(): Promise<void> {
    try {
      const response = await fetch('/api/account/methods', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { methods: string[] };
      this.methods.set(result.methods);
    } catch {
      this.error.set('לא ניתן לטעון את שיטות החיבור.');
    }
  }
  async signOut(): Promise<void> {
    if (await this.session.signOut()) await this.router.navigateByUrl('/login');
  }
  async previewImport(): Promise<void> {
    this.error.set('');
    try {
      this.preview.set(await this.store.previewImport());
    } catch {
      this.error.set('לא ניתן להכין ייבוא. ייתכן שהייבוא כבר בוצע או שהחיבור פג.');
    }
  }
  async import(): Promise<void> {
    const preview = this.preview();
    if (preview && (await this.store.import(preview))) {
      this.preview.set(null);
      this.message.set('נתוני ההדגמה יובאו לחשבון כרישומי הדגמה בלבד. העותק במכשיר נשמר.');
    }
  }
  async removeData(): Promise<void> {
    if (await this.store.deleteAccountData()) {
      this.confirmDelete.set(false);
      this.message.set(
        'נתוני החשבון השמורים נמחקו. החשבון ושיטות ההתחברות נשמרו; נתוני ההדגמה במכשיר לא נמחקו.',
      );
    }
  }
  async link(provider: 'google' | 'apple'): Promise<void> {
    if (this.linking()) return;
    this.linking.set(true);
    this.error.set('');
    try {
      const result = await this.session.auth('link-social', {
        provider,
        callbackURL: `${location.origin}/account`,
        errorCallbackURL: `${location.origin}/account?oauth=error`,
      });
      const url = new URL(String(result['url']));
      if (
        url.protocol !== 'https:' ||
        !['accounts.google.com', 'appleid.apple.com'].includes(url.hostname)
      )
        throw new Error();
      location.assign(url.href);
    } catch {
      this.linking.set(false);
      this.error.set('לא ניתן לקשר את השיטה. יש להתחבר מחדש ולהשלים את האימות אצל הספק.');
    }
  }
}
