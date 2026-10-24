import { localDate } from '../core/local-date';
import { AppStore } from '../core/app-store';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CareerStore, careerError } from '../core/career-store';
import type { Conversation, ChatMessage, JobReference } from '../core/models/career';
@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './assistant.html',
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
  readonly conversations = signal<Conversation[]>([]);
  readonly jobs = signal<
    (Pick<JobReference, 'id' | 'title' | 'company'> & Partial<JobReference>)[]
  >([]);
  readonly conversationId = signal<string | null>(null);
  readonly deleteId = signal<string | null>(null);
  readonly jobId = this.route.snapshot.queryParamMap.get('job') ?? '';
  readonly store = inject(AppStore);
  readonly selectedJob = computed(() => this.store.findJob(this.jobId));
  message = '';
  consent = false;
  includeResume = false;
  lastMessage = '';
  private abort: AbortController | null = null;
  private generation = 0;
  constructor() {
    if (this.jobId) void this.store.ensureJob(this.jobId);
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
    });
    effect(() => {
      if (this.career.ready()) untracked(() => void this.load());
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
  }
  async load(reconcile = false) {
    const owner = this.career.session.userId();
    const generation = this.generation;
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
      this.error.set(e instanceof Error ? e.message : 'לא ניתן לטעון שיחות.');
    }
  }
  stop() {
    this.generation++;
    this.abort?.abort();
    this.busy.set(false);
    this.partial.set('');
    this.error.set('התשובה נעצרה ולא נשמרה. אפשר לנסות שוב.');
  }
  fresh() {
    if (this.busy()) this.stop();
    this.conversationId.set(null);
    this.messages.set([]);
    this.partial.set('');
    this.jobs.set([]);
    this.error.set('');
    this.lastMessage = '';
  }
  open(conversation: Conversation) {
    this.fresh();
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
    if (!id) return;
    try {
      await this.career.request(`conversations/${id}/delete`, {});
      if (this.conversationId() === id) this.fresh();
      this.deleteId.set(null);
      await this.load();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'המחיקה נכשלה.');
    }
  }
  async send(retry = false) {
    if (this.busy() || !this.consent) return;
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
          jobId: this.jobId || undefined,
          aiConsent: true,
          includeResume: this.includeResume,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(careerError(data.error));
      }
      if (!response.body) throw new Error('לא התקבל זרם תשובה.');
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
        this.error.set(e instanceof Error ? e.message : 'השיחה לא הושלמה.');
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
