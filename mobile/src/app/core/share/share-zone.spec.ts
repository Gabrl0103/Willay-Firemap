import { isCancel, shareMessage, type ShareChannels } from './share-zone';

const MESSAGE = { title: 'Riesgo de incendio en Pasto', text: 'Pasto: riesgo de incendio Bajo (20 de 100).' };

describe('shareMessage', () => {
  it('uses the app menu on the phone', async () => {
    const native = vi.fn(async () => ({}));
    const copy = vi.fn(async () => undefined);
    expect(await shareMessage(MESSAGE, { native, copy })).toBe('shared');
    expect(native).toHaveBeenCalledWith(MESSAGE);
    expect(copy).not.toHaveBeenCalled();
  });

  it('uses the browser menu when there is one', async () => {
    const web = vi.fn(async () => undefined);
    expect(await shareMessage(MESSAGE, { web, copy: vi.fn() })).toBe('shared');
    expect(web).toHaveBeenCalledWith(MESSAGE);
  });

  it('copies the text when the browser has no menu', async () => {
    const copied: string[] = [];
    expect(await shareMessage(MESSAGE, { copy: async (text) => void copied.push(text) })).toBe('copied');
    expect(copied).toEqual([MESSAGE.text]);
  });

  it('says nothing went wrong when the user closes the menu', async () => {
    const copy = vi.fn(async () => undefined);
    const abort: ShareChannels = { web: () => Promise.reject(new DOMException('Share canceled', 'AbortError')), copy };
    expect(await shareMessage(MESSAGE, abort)).toBe('cancelled');
    expect(await shareMessage(MESSAGE, { native: () => Promise.reject(new Error('Share canceled')) })).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });

  it('copies when the browser refuses its menu, and fails only without any way out', async () => {
    const refuse = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    expect(await shareMessage(MESSAGE, { web: refuse, copy: async () => undefined })).toBe('copied');
    expect(await shareMessage(MESSAGE, { web: refuse })).toBe('failed');
    expect(await shareMessage(MESSAGE, { copy: () => Promise.reject(new Error('denied')) })).toBe('failed');
    expect(await shareMessage(MESSAGE, {})).toBe('failed');
  });
});

describe('isCancel', () => {
  it('tells a closed menu from a real error', () => {
    expect(isCancel(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isCancel(new Error('Share canceled'))).toBe(true);
    expect(isCancel(new Error('Share API not available'))).toBe(false);
    expect(isCancel('cancel')).toBe(false);
  });
});
