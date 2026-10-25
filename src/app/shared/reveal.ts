import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[nivaReveal]' })
export class Reveal {
  constructor() {
    const element = inject(ElementRef<HTMLElement>).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('IntersectionObserver' in window)
      )
        return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            element.classList.add('niva-revealed');
            observer.disconnect();
          }
        },
        { threshold: 0.08 },
      );
      observer.observe(element);
      destroy.onDestroy(() => observer.disconnect());
    });
  }
}
