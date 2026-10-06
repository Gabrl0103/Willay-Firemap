import { TestBed } from '@angular/core/testing';
import { OnboardingFlag } from '../../../core/onboarding-flag';
import { Onboarding } from './onboarding';

describe('Onboarding', () => {
  afterEach(() => vi.useRealTimers());

  it('remembers it was seen and closes when skipped', async () => {
    vi.useFakeTimers();
    const markDone = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: OnboardingFlag, useValue: { markDone } }] });
    const fixture = TestBed.createComponent(Onboarding);
    const finished = vi.fn();
    fixture.componentInstance.finished.subscribe(finished);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.skip')!.click();
    fixture.detectChanges();

    expect(markDone).toHaveBeenCalledOnce();
    expect(host.classList).toContain('leaving');
    vi.advanceTimersByTime(400);
    expect(finished).toHaveBeenCalledOnce();
  });

  it('shows three progress dots with the first one active', () => {
    const fixture = TestBed.createComponent(Onboarding);
    fixture.detectChanges();
    const dots = (fixture.nativeElement as HTMLElement).querySelectorAll('.dots i');
    expect(dots.length).toBe(3);
    expect(dots[0].classList).toContain('active');
    expect(fixture.nativeElement.querySelector('.cta').textContent.trim()).toBe('Continuar');
  });
});
