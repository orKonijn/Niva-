import { Injectable, signal, computed } from '@angular/core';
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}
export interface AuthConfiguration {
  platform?: 'sites';
  realJobs?: boolean;
  discovery?: boolean;
  emailDelivery?: 'local-outbox' | 'smtp' | 'configured' | 'unavailable';
  accounts: boolean;
  email: boolean;
  google: boolean;
  apple: boolean;
}
export function safeReturn(value: string | null): string {
  return value && /^\/(?:app(?:\/|\?|$)|account(?:\/|\?|$))/.test(value) && !/[\\\r\n]/.test(value)
    ? value
    : '/app';
}
@Injectable({ providedIn: 'root' })
export class AccountSession {
  readonly user = signal<AccountUser | null>(null);
  readonly userId = computed(() => this.user()?.id ?? null);
  private generation = 0;
  clear(): void {
    this.generation++;
    this.user.set(null);
  }
  readonly loading = signal(true);
  readonly config = signal<AuthConfiguration>({
    accounts: false,
    email: false,
    google: false,
    apple: false,
  });
  readonly notice = signal('');
  private readonly channel =
    typeof BroadcastChannel === 'function' ? new BroadcastChannel('niva.account.session') : null;
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.initialize();
    if (this.channel)
      this.channel.onmessage = () => {
        void this.refresh();
      };
  }
  private async initialize(): Promise<void> {
    try {
      const response = await fetch('/api/config');
      if (response.ok && response.headers.get('content-type')?.includes('application/json'))
        this.config.set((await response.json()) as AuthConfiguration);
      await this.refresh();
    } catch {
      this.notice.set('שירות החשבון אינו זמין. אפשר להמשיך בהדגמה המקומית.');
    } finally {
      this.loading.set(false);
    }
  }
  async refresh(): Promise<void> {
    if (!this.config().accounts) return;
    const generation = ++this.generation;
    try {
      const response = await fetch('/api/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      const value = (await response.json()) as { user: AccountUser | null };
      if (generation === this.generation) {
        this.user.set(value.user?.emailVerified ? value.user : null);
        this.notice.set('');
      }
    } catch {
      if (generation === this.generation) {
        this.clear();
        this.notice.set('לא ניתן לאמת את החיבור לחשבון. יש להתחבר שוב.');
      }
    }
  }
  async auth(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data['code'] ?? 'AUTH_FAILED'));
    return data;
  }
  async signedIn(): Promise<void> {
    await this.refresh();
    this.channel?.postMessage('refresh');
  }
  async signOut(): Promise<boolean> {
    this.generation++;
    if (this.config().platform === 'sites') {
      this.clear();
      location.assign('/signout-with-chatgpt?return_to=%2Flogin');
      return false;
    }
    try {
      await this.auth('sign-out', {});
      this.clear();
      this.channel?.postMessage('refresh');
      return true;
    } catch {
      this.notice.set('הניתוק לא הושלם בשרת. יש לנסות שוב.');
      return false;
    }
  }
  ngOnDestroy(): void {
    this.channel?.close();
  }
}
