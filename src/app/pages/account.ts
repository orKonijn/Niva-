import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Brand } from '../shared/brand';
import { ProviderLogo } from '../shared/provider-logo';
import { AppStore, type ImportPreview } from '../core/app-store';
import { AccountSession } from '../core/account-session';
import { categoryLabel, districtLabel, workStylesLabel } from '../core/preferences';
@Component({
  imports: [FormsModule, RouterLink, Brand, ProviderLogo],
  templateUrl: './account.html',
  styleUrl: './account.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  readonly store = inject(AppStore);
  readonly session = inject(AccountSession);
  readonly router = inject(Router);
  readonly methods = signal<string[]>([]);
  readonly methodsError = signal('');
  private methodsRequest = 0;
  readonly preview = signal<ImportPreview | null>(null);
  readonly message = signal('');
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  readonly linking = signal(false);
  readonly actionBusy = signal(false);
  readonly categoryLabel = categoryLabel;
  readonly districtLabel = districtLabel;
  readonly workStylesLabel = workStylesLabel;
  readonly displayName = computed(
    () =>
      (this.store.accountReady() ? this.store.account().profile.name.trim() : '') ||
      this.session.user()?.name.trim() ||
      'לא צוין שם',
  );
  readonly matchingDetails = computed(() => {
    const criteria = this.store.accountReady() ? this.store.account().profile.criteria : undefined;
    if (!criteria) return [];
    const missing = 'לא ידוע / לא נמסר';
    return [
      { label: 'מצב הפרטים', value: criteria.confirmed ? 'אושרו על ידך' : 'טרם אושרו' },
      { label: 'כישורים', value: criteria.skills.join(', ') || 'לא נמסרו' },
      { label: 'שנות ניסיון רלוונטי', value: criteria.yearsExperience ?? 'לא נמסרו' },
      { label: 'מדינה נוכחית', value: criteria.currentCountry || 'לא נמסרה' },
      { label: 'מדינה לאישור העבודה', value: criteria.authorizationCountry || 'לא נמסרה' },
      {
        label: 'אישור עבודה',
        value: { unknown: missing, authorized: 'יש אישור', 'not-authorized': 'אין אישור' }[
          criteria.workAuthorization
        ],
      },
      {
        label: 'הגבלת אישור העבודה',
        value: criteria.authorizationExclusive
          ? 'הוגבל למדינה שצוינה'
          : 'לא סומנה הגבלה למדינה אחת',
      },
      {
        label: 'צורך בחסות אשרה',
        value: { unknown: missing, needed: 'נדרשת חסות', 'not-needed': 'לא נדרשת חסות' }[
          criteria.sponsorship
        ],
      },
      { label: 'מדינה לבדיקת אזרחות', value: criteria.citizenshipCountry || 'לא נמסרה' },
      {
        label: 'אזרחות במדינה שצוינה',
        value: { unknown: missing, citizen: 'יש אזרחות', 'not-citizen': 'אין אזרחות' }[
          criteria.citizenshipStatus ?? 'unknown'
        ],
      },
      { label: 'שפות', value: criteria.languages.join(', ') || 'לא נמסרו' },
      { label: 'השכלה והסמכות', value: criteria.qualifications.join(', ') || 'לא נמסרו' },
      { label: 'רישיונות', value: criteria.licenses.join(', ') || 'לא נמסרו' },
      {
        label: 'סיווג ביטחוני',
        value: { unknown: missing, none: 'אין סיווג', held: 'יש סיווג; סוג ותוקף דורשים בדיקה' }[
          criteria.clearance
        ],
      },
      { label: 'שכר מינימום מבוקש', value: criteria.salaryMin ?? 'לא נמסר' },
      { label: 'מטבע', value: criteria.currency || 'לא נמסר' },
      {
        label: 'תקופת שכר',
        value: criteria.period
          ? { hour: 'שעה', month: 'חודש', year: 'שנה' }[criteria.period]
          : 'לא נמסרה',
      },
      { label: 'סוגי העסקה', value: criteria.employmentTypes.join(', ') || 'לא נמסרו' },
      { label: 'אזור זמן מועדף', value: criteria.timezone || 'לא נמסר' },
    ];
  });
  constructor() {
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('oauth'))
      this.error.set('קישור שיטת ההתחברות בוטל או נכשל. לא נוספה שיטה חדשה.');
    effect(() => {
      const owner = this.session.userId();
      this.methods.set([]);
      this.methodsError.set('');
      if (owner) void this.loadMethods(owner);
    });
  }
  async loadMethods(owner = this.session.userId()): Promise<void> {
    const request = ++this.methodsRequest;
    try {
      const response = await fetch('/api/account/methods', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as { methods: string[] };
      if (request === this.methodsRequest && owner === this.session.userId())
        this.methods.set(result.methods);
    } catch {
      if (request === this.methodsRequest && owner === this.session.userId())
        this.methodsError.set('לא ניתן לטעון את שיטות החיבור.');
    }
  }
  async signOut(): Promise<void> {
    if (await this.session.signOut()) await this.router.navigateByUrl('/login');
  }
  async previewImport(): Promise<void> {
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.error.set('');
    try {
      this.preview.set(await this.store.previewImport());
    } catch {
      this.error.set('לא ניתן להכין ייבוא. ייתכן שהייבוא כבר בוצע או שהחיבור פג.');
    } finally {
      this.actionBusy.set(false);
    }
  }
  async import(): Promise<void> {
    if (this.store.busy()) return;
    const preview = this.preview();
    if (preview && (await this.store.import(preview))) {
      this.preview.set(null);
      this.message.set('נתוני ההדגמה יובאו לחשבון כרישומי הדגמה בלבד. העותק במכשיר נשמר.');
    }
  }
  async removeData(): Promise<void> {
    if (this.store.busy()) return;
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
