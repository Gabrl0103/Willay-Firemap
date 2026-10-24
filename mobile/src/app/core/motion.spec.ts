import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '../state/settings.store';
import { Motion, REDUCE_MOTION_CLASS } from './motion';

describe('Motion', () => {
  afterEach(() => document.documentElement.classList.remove(REDUCE_MOTION_CLASS));

  it('follows the phone in «Automático» and stops everything in «Reducido»', async () => {
    const motion = TestBed.inject(Motion);
    const settings = TestBed.inject(SettingsStore);
    expect(motion.reduced()).toBe(false); // jsdom asks for no reduced motion
    expect(document.documentElement.classList).not.toContain(REDUCE_MOTION_CLASS);

    await settings.update({ motion: 'reduced' });
    TestBed.tick();
    expect(motion.reduced()).toBe(true);
    expect(document.documentElement.classList).toContain(REDUCE_MOTION_CLASS);

    await settings.update({ motion: 'auto' });
    TestBed.tick();
    expect(motion.reduced()).toBe(false);
    expect(document.documentElement.classList).not.toContain(REDUCE_MOTION_CLASS);
  });
});
