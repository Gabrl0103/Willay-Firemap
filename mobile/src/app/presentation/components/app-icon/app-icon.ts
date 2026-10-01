import { Component, input } from '@angular/core';

export type IconName =
  | 'search' | 'crosshair' | 'map' | 'history' | 'flame' | 'x' | 'chevron-right'
  | 'map-pin' | 'calendar' | 'alert' | 'wind' | 'thermometer' | 'droplet';

/** Small inline SVG icon set (24x24, stroke). Keeps the APK free of icon fonts. */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('search') { <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /> }
        @case ('crosshair') {
          <circle cx="12" cy="12" r="10" /><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4" />
        }
        @case ('map') {
          <path d="M14.1 5.55a2 2 0 0 0 1.8 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.55 2.28a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.55-2.28a2 2 0 0 1 1.8 0z" />
          <path d="M15 5.76v15M9 3.24v15" />
        }
        @case ('history') {
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l4 2" />
        }
        @case ('flame') {
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6" /> }
        @case ('map-pin') {
          <path d="M20 10c0 5-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 15 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" />
        }
        @case ('calendar') {
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        }
        @case ('alert') {
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" />
        }
        @case ('wind') {
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2" />
        }
        @case ('thermometer') { <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /> }
        @case ('droplet') {
          <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; } svg { display: block; }`,
})
export class AppIcon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
