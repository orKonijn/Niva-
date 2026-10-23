import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'niva-provider-logo',
  host: { class: 'inline-flex shrink-0', 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (provider() === 'google') {
      <svg width="20" height="20" viewBox="0 0 48 48" fill="none" focusable="false">
        <path
          fill="#4285F4"
          d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5.13h6.61c3.86-3.55 6.08-8.78 6.08-14.8Z"
        />
        <path
          fill="#34A853"
          d="M24 44c5.51 0 10.13-1.83 13.51-4.94l-6.61-5.13c-1.83 1.23-4.17 1.97-6.9 1.97-5.32 0-9.84-3.59-11.46-8.43H5.73v5.29A20 20 0 0 0 24 44Z"
        />
        <path
          fill="#FBBC05"
          d="M12.54 27.47a12 12 0 0 1 0-6.94v-5.29H5.73a20 20 0 0 0 0 17.52l6.81-5.29Z"
        />
        <path
          fill="#EA4335"
          d="M24 12.1c3.01 0 5.69 1.04 7.82 3.09l5.86-5.86A19.64 19.64 0 0 0 24 4 20 20 0 0 0 5.73 15.24l6.81 5.29C14.16 15.69 18.68 12.1 24 12.1Z"
        />
      </svg>
    } @else {
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" focusable="false">
        <path
          d="M17.05 12.54c.03 3.02 2.65 4.02 2.68 4.03-.02.07-.42 1.44-1.38 2.86-.83 1.23-1.7 2.46-3.06 2.48-1.34.03-1.77-.8-3.3-.8-1.53 0-2 .78-3.27.83-1.31.05-2.3-1.33-3.14-2.56-1.71-2.5-3.02-7.08-1.27-10.17.87-1.53 2.43-2.5 4.13-2.53 1.29-.03 2.5.88 3.3.88.8 0 2.3-1.09 3.87-.93.66.03 2.5.27 3.68 2.02-.1.06-2.2 1.3-2.24 3.89ZM14.54 4.97c.7-.85 1.17-2.04 1.04-3.22-1 .04-2.22.68-2.94 1.53-.65.75-1.22 1.95-1.07 3.1 1.12.09 2.27-.57 2.97-1.41Z"
        />
      </svg>
    }
  `,
})
export class ProviderLogo {
  readonly provider = input.required<'google' | 'apple'>();
}
