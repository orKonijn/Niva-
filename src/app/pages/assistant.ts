import { localDate } from '../core/local-date';
import { AppStore } from '../core/app-store';
import { Icon } from '../shared/icon';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ElementRef,
  viewChild,
  afterRenderEffect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CareerStore, careerError } from '../core/career-store';
import type { Conversation, ChatMessage, JobReference } from '../core/models/career';
@Component({
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Assistant {
  readonly localDate = localDate;
  readonly career = inject(CareerStore);
  readonly route = inject(ActivatedRoute);
  readonly messages = signal<ChatMessage[]>([]);
  readonly partial = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly historyError = signal('');
  readonly historyLoading = signal(false);
  readonly mode = signal<'guide' | 'ai'>('guide');
  readonly guideAction = signal('search');
  readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  readonly log = viewChild<ElementRef<HTMLElement>>('messageLog');
  readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');
  private initialized = false;
  displayText(text: string) {
    return text.replace(/\[job:[^\]]+\]/g, '').trim();
  }
  readonly conversations = signal<Conversation[]>([]);
  readonly jobs = signal<
    (Pick<JobReference, 'id' | 'title' | 'company'> & Partial<JobReference>)[]
  >([]);
  readonly conversationId = signal<string | null>(null);
  readonly deleteId = signal<string | null>(null);
  readonly deleteError = signal('');
  readonly deleting = signal(false);
  readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly jobId = computed(() => this.query().get('job') ?? '');
  readonly store = inject(AppStore);
  readonly selectedJob = computed(() => this.store.findJob(this.jobId()));
  message = '';
  consent = false;
  includeResume = false;
  lastMessage = '';
  private abort: AbortController | null = null;
  private generation = 0;
  constructor() {
    effect(() => {
      const id = this.jobId();
      const discovery = this.store.session.config().discovery;
      untracked(() => {
        this.generation++;
        this.abort?.abort();
        this.busy.set(false);
        this.fresh(false);
        if (id && discovery) void this.store.ensureJob(id);
      });
    });
    effect(() => {
      this.career.session.userId();
      this.career.generation();
      this.message = '';
      this.lastMessage = '';
      this.deleteId.set(null);
      this.generation++;
      this.abort?.abort();
      this.messages.set([]);
      this.partial.set('');
      this.conversations.set([]);
      this.jobs.set([]);
      this.conversationId.set(null);
      this.busy.set(false);
      this.consent = false;
      this.includeResume = false;
      this.initialized = false;
    });
    effect(() => {
      if (this.career.ready())
        untracked(() => {
          if (!this.initialized) {
            this.mode.set(this.career.config().ai ? 'ai' : 'guide');
            this.initialized = true;
          }
          void this.load();
        });
    });
    effect(() => {
      const change = this.career.changes();
      if (!change) return;
      untracked(() => {
        if (
          change.kind === 'resume' ||
          (change.kind === 'conversation' && change.id === this.conversationId())
        ) {
          this.fresh();
          this.message = '';
          this.lastMessage = '';
        }
        void this.load(true);
      });
    });
    afterRenderEffect(() => {
      this.messages();
      this.partial();
      this.busy();
      const element = this.log()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
    afterRenderEffect(() => {
      const dialog = this.deleteDialog()?.nativeElement;
      if (this.deleteId() && dialog && !dialog.open) dialog.showModal();
      else if (!this.deleteId() && dialog?.open) dialog.close();
    });
  }
  get canSend() {
    return (
      this.career.ready() &&
      !this.career.error() &&
      !this.busy() &&
      !!this.message.trim() &&
      (this.mode() === 'guide' || (this.consent && this.career.config().ai))
    );
  }
  switchMode(mode: 'guide' | 'ai') {
    if (this.busy() || mode === this.mode() || (mode === 'ai' && !this.career.config().ai)) return;
    this.fresh();
    this.mode.set(mode);
    this.message = '';
    this.consent = false;
    this.includeResume = false;
  }
  suggest(action: string, message: string) {
    this.guideAction.set(action);
    this.message = message;
    this.composer()?.nativeElement.focus();
  }
  async load(reconcile = false) {
    const owner = this.career.session.userId();
    const generation = this.generation;
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const conversations = await this.career.request<Conversation[]>('conversations');
      if (generation === this.generation && owner === this.career.session.userId()) {
        this.conversations.set(conversations);
        if (
          reconcile &&
          this.conversationId() &&
          !conversations.some((c) => c.id === this.conversationId())
        )
          this.fresh();
      }
    } catch (e) {
      if (generation === this.generation && owner === this.career.session.userId())
        this.historyError.set(e instanceof Error ? e.message : 'לא ניתן לטעון שיחות.');
    } finally {
      if (generation === this.generation) this.historyLoading.set(false);
    }
  }
  stop() {
    this.generation++;
    this.abort?.abort();
    this.busy.set(false);
    this.partial.set('');
    this.error.set('התשובה נעצרה ולא נשמרה. אפשר לנסות שוב.');
  }
  fresh(clearDraft = true) {
    this.generation++;
    this.abort?.abort();
    this.busy.set(false);
    this.conversationId.set(null);
    this.messages.set([]);
    this.partial.set('');
    this.jobs.set([]);
    this.error.set('');
    this.lastMessage = '';
    if (clearDraft) this.message = '';
  }
  open(conversation: Conversation) {
    this.fresh();
    this.mode.set(conversation.mode ?? 'ai');
    this.consent = false;
    this.includeResume = false;
    this.conversationId.set(conversation.id);
    this.messages.set(conversation.messages);
    this.jobs.set([
      ...new Map(
        conversation.messages.flatMap((m) => m.references || []).map((r) => [r.id, r]),
      ).values(),
    ]);
  }
  async remove() {
    const id = this.deleteId();
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await this.career.request(`conversations/${id}/delete`, {});
      if (this.conversationId() === id) this.fresh();
      this.deleteId.set(null);
      await this.load();
    } catch (e) {
      this.deleteError.set(e instanceof Error ? e.message : 'המחיקה נכשלה.');
    } finally {
      this.deleting.set(false);
    }
  }
  async send(retry = false) {
    if (
      this.busy() ||
      !this.career.ready() ||
      this.career.error() ||
      (this.mode() === 'ai' && (!this.consent || !this.career.config().ai))
    )
      return;
    const message = retry ? this.lastMessage : this.message.trim();
    if (!message) return;
    this.lastMessage = message;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.abort = controller;
    this.busy.set(true);
    this.error.set('');
    this.partial.set('');
    let completed = false;
    let newId = this.conversationId();
    try {
      const response = await fetch('/api/career/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Niva-CSRF': '1' },
        body: JSON.stringify({
          message,
          conversationId: this.conversationId() ?? undefined,
          jobId: this.jobId() || undefined,
          aiConsent: this.mode() === 'ai' && this.consent,
          includeResume: this.includeResume,
          mode: this.mode(),
          ...(this.mode() === 'guide'
            ? {
                action: this.guideAction(),
              }
            : {}),
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'AI_UNAVAILABLE' }));
        throw new Error(careerError(data.error));
      }
      if (!response.body) throw new Error('לא התקבל זרם תשובה.');
      if (generation !== this.generation) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (generation !== this.generation) return;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const event = block
              .split('\n')
              .find((l) => l.startsWith('event:'))
              ?.slice(6)
              .trim();
            const raw = block
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('\n');
            if (!raw) continue;
            const data = JSON.parse(raw);
            if (event === 'context') {
              newId = data.conversationId;
              this.jobs.set(data.jobs);
            }
            if (event === 'delta') this.partial.update((t) => t + data.text);
            if (event === 'failure') throw new Error(careerError(data.error));
            if (event === 'done') completed = true;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (!completed) throw new Error('התשובה לא הושלמה ולא נשמרה. אפשר לנסות שוב.');
      if (generation !== this.generation) return;
      this.conversationId.set(newId);
      this.messages.update((messages) => [
        ...messages,
        { role: 'user', text: message },
        { role: 'assistant', text: this.partial() },
      ]);
      this.partial.set('');
      this.message = '';
      await this.load();
    } catch (e) {
      if (generation === this.generation) {
        this.partial.set('');
        this.jobs.set([]);
        this.error.set(
          e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'AbortError'
            ? e.message
            : 'הבקשה לא הושלמה בזמן. ההודעה נשמרה בשדה; אפשר לנסות שוב.',
        );
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  ngOnDestroy() {
    this.generation++;
    this.abort?.abort();
  }
}
