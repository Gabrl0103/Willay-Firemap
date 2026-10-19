import axios from 'axios';

/** Waits before the 2nd and 3rd attempts: 3 attempts in total. */
export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000];

export interface RetryOptions {
  /** Wait before each new attempt; its length + 1 is the number of attempts. */
  readonly delaysMs?: readonly number[];
  /** Whether a failed attempt is worth repeating. */
  readonly shouldRetry?: (error: unknown) => boolean;
  /** Tests pass a fake to avoid real waits. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Timeouts, network errors and 5xx answers can pass on their own. 4xx do not (an invalid key or an
 * exceeded limit): repeating them only spends the quota.
 */
export function isTransientHttpError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status === undefined) return true; // timeout or no answer at all
  return status >= 500;
}

/** Runs `attempt` until it works, waiting longer each time; rethrows the last error. */
export async function retry<T>(attempt: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { delaysMs = DEFAULT_RETRY_DELAYS_MS, shouldRetry = isTransientHttpError, sleep = wait } = options;
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (error) {
      const delay = delaysMs[i];
      if (delay === undefined || !shouldRetry(error)) throw error;
      await sleep(delay);
    }
  }
}
