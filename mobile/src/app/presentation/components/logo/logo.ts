import { Component, input } from '@angular/core';

/** eye: solo el ojo. light: ojo + "Atalaya" claro (fondos oscuros). dark: ojo + "Atalaya" oscuro (fondos crema). */
export type LogoVariant = 'eye' | 'light' | 'dark';

/** Logo "Ojo de vigía": un ojo con una llama como pupila. */
@Component({
  selector: 'app-logo',
  template: `
    <svg class="eye" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M6 52c13-22 28-32 44-32s31 10 44 32c-13 22-28 32-44 32S19 74 6 52z"
        fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"
      />
      <circle cx="50" cy="52" r="25" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4" />
      <g transform="translate(32.6 38.2) scale(1.45)">
        <path
          d="M12 2.5c.8 3.6 5.2 5.4 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.3 2.1-4.3.1 1.9.9 2.9 2 3.3-.3-3 0-6.2 1.1-9z"
          fill="currentColor"
        />
      </g>
    </svg>
    @if (variant() !== 'eye') {
      <span class="word-wrap" aria-hidden="true"><span class="word">Atalaya</span></span>
    }
  `,
  styleUrl: './logo.css',
  host: {
    role: 'img',
    'aria-label': 'Atalaya',
    '[attr.data-variant]': 'variant()',
    '[class.intro]': 'intro()',
    '[style.font-size.px]': 'size()',
  },
})
export class Logo {
  readonly variant = input<LogoVariant>('light');
  /** Horizontal: tamaño del texto "Atalaya" en px. Solo ojo: lado del ojo en px. */
  readonly size = input(32);
  /** Animación de la splash: el ojo entra con zoom, centrado, y "Atalaya" se revela de izquierda a derecha. */
  readonly intro = input(false);
}
