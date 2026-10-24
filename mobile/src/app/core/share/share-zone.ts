import { Injectable, InjectionToken, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/** How a share ended: sent to the system menu, copied (no menu here), closed by the user, or impossible. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareMessage {
  readonly title: string;
  readonly text: string;
}

/** What this device offers to share text; each one is optional so the browser can fall back to the next. */
export interface ShareChannels {
  /** @capacitor/share, only in the Android app. */
  readonly native?: (message: ShareMessage) => Promise<unknown>;
  /** navigator.share (phones' browsers and some desktops). */
  readonly web?: (message: ShareMessage) => Promise<void>;
  /** The clipboard, the last resort («Copiado»). */
  readonly copy?: (text: string) => Promise<void>;
}

export const SHARE_CHANNELS = new InjectionToken<ShareChannels>('SHARE_CHANNELS', {
  providedIn: 'root',
  factory: (): ShareChannels => {
    if (Capacitor.isNativePlatform()) {
      return { native: (message) => Share.share({ ...message, dialogTitle: 'Compartir' }) };
    }
    return {
      web: typeof navigator.share === 'function' ? (message) => navigator.share(message) : undefined,
      copy: navigator.clipboard ? (text) => navigator.clipboard.writeText(text) : undefined,
    };
  },
});

/**
 * Closing the menu without picking an app is not an error: the browser rejects with AbortError and
 * @capacitor/share with "Share canceled".
 */
export function isCancel(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && /cancel/i.test(error.message);
}

/** Shares through the first channel this device has: the app's menu, the browser's, or the clipboard. */
export async function shareMessage(message: ShareMessage, channels: ShareChannels): Promise<ShareOutcome> {
  const menu = channels.native ?? channels.web;
  if (menu) {
    try {
      await menu(message);
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
      // A browser that refuses its menu (no permission, not from a tap) can still copy.
      if (channels.native || !channels.copy) return 'failed';
    }
  }
  if (!channels.copy) return 'failed';
  try {
    await channels.copy(message.text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

@Injectable({ providedIn: 'root' })
export class ZoneSharer {
  private readonly channels = inject(SHARE_CHANNELS);

  share(message: ShareMessage): Promise<ShareOutcome> {
    return shareMessage(message, this.channels);
  }
}
