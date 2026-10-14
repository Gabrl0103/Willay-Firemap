import { Component } from '@angular/core';

interface Blob {
  /** Ancho en px; el alto es 1.45 × ancho. */
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly rot: number;
  readonly blur: number;
  readonly dur: number;
  readonly delay: number;
  readonly reverse: boolean;
}

/** Fondo de "lámpara de lava": partículas ovoides con DOM + CSS (sin canvas). */
@Component({
  selector: 'app-lava-bg',
  template: `
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>
    @for (b of blobs; track $index) {
      <span
        class="blob"
        [style.width.px]="b.w"
        [style.height.px]="b.w * 1.45"
        [style.left.%]="b.x"
        [style.top.%]="b.y"
        [style.rotate.deg]="b.rot"
        [style.filter]="b.blur ? 'blur(' + b.blur + 'px)' : null"
        [style.animation-duration.s]="b.dur"
        [style.animation-delay.s]="b.delay"
        [style.animation-direction]="b.reverse ? 'alternate-reverse' : 'alternate'"
      ></span>
    }
  `,
  styleUrl: './lava-bg.css',
})
export class LavaBg {
  protected readonly blobs: readonly Blob[] = [
    { w: 70, x: 8, y: 62, rot: -18, blur: 0, dur: 12, delay: 0, reverse: false },
    { w: 44, x: 78, y: 18, rot: 14, blur: 1, dur: 10, delay: -2, reverse: true },
    { w: 28, x: 55, y: 74, rot: -8, blur: 0, dur: 9, delay: -4, reverse: false },
    { w: 56, x: 88, y: 68, rot: 22, blur: 2, dur: 14, delay: -1, reverse: true },
    { w: 18, x: 30, y: 30, rot: -24, blur: 1, dur: 8, delay: -3, reverse: false },
    { w: 36, x: 14, y: 12, rot: 9, blur: 0, dur: 11, delay: -5, reverse: true },
    { w: 12, x: 66, y: 48, rot: 26, blur: 0, dur: 8, delay: -6, reverse: false },
    { w: 24, x: 42, y: 88, rot: -14, blur: 1, dur: 10, delay: -2.5, reverse: true },
    { w: 50, x: -6, y: 38, rot: 18, blur: 2, dur: 13, delay: -7, reverse: false },
    { w: 16, x: 92, y: 40, rot: -20, blur: 0, dur: 9, delay: -1.5, reverse: true },
    { w: 32, x: 24, y: 70, rot: 4, blur: 1, dur: 12, delay: -8, reverse: false },
    { w: 22, x: 72, y: 84, rot: -6, blur: 0, dur: 10, delay: -3.5, reverse: true },
  ];
}
