import { Pipe, inject, type PipeTransform } from '@angular/core';
import { I18n, type MessageKey, type MessageParams, type PluralKey } from './i18n';

/** {{ 'home.title' | t }} or {{ 'sheet.hotspots' | t: { count: n } }}; follows the language as it changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(key: MessageKey | PluralKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
