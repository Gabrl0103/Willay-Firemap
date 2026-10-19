import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { isTransientHttpError, retry } from '../src/infrastructure/external/retry.js';

const httpError = (status: number): AxiosError =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: '',
  } as AxiosResponse);
const timeout = (): AxiosError => new AxiosError('timeout of 30000ms exceeded', AxiosError.ECONNABORTED);
const networkError = (): AxiosError => new AxiosError('socket hang up', 'ECONNRESET');

/** Runs `retry` with a fake clock: records the waits instead of sleeping. */
function run<T>(attempts: Array<() => T>) {
  const waits: number[] = [];
  let calls = 0;
  const result = retry(
    async () => {
      const next = attempts[Math.min(calls, attempts.length - 1)]!;
      calls++;
      return next();
    },
    { sleep: async (ms) => void waits.push(ms) },
  );
  return { result, waits, calls: () => calls };
}

describe('retry', () => {
  it('succeeds on the second attempt after a timeout, waiting 2 s', async () => {
    const { result, waits, calls } = run([() => { throw timeout(); }, () => 'csv']);
    assert.equal(await result, 'csv');
    assert.equal(calls(), 2);
    assert.deepEqual(waits, [2_000]);
  });

  it('gives up after 3 attempts (2 s and 5 s apart) and throws the last error', async () => {
    const { result, waits, calls } = run([() => { throw httpError(503); }]);
    await assert.rejects(result, (error: unknown) => error instanceof AxiosError && error.response?.status === 503);
    assert.equal(calls(), 3);
    assert.deepEqual(waits, [2_000, 5_000]);
  });

  it('does not retry a 4xx (invalid key or limit exceeded)', async () => {
    for (const status of [400, 403, 429]) {
      const { result, waits, calls } = run([() => { throw httpError(status); }, () => 'csv']);
      await assert.rejects(result, (error: unknown) => error instanceof AxiosError && error.response?.status === status);
      assert.equal(calls(), 1);
      assert.deepEqual(waits, []);
    }
  });

  it('does not retry errors that are not HTTP (e.g. an unexpected FIRMS answer)', async () => {
    const { result, calls } = run([() => { throw new Error('Unexpected FIRMS response: Invalid MAP_KEY.'); }]);
    await assert.rejects(result, /Invalid MAP_KEY/);
    assert.equal(calls(), 1);
  });
});

describe('isTransientHttpError', () => {
  it('retries timeouts, network errors and 5xx only', () => {
    assert.equal(isTransientHttpError(timeout()), true);
    assert.equal(isTransientHttpError(networkError()), true);
    assert.equal(isTransientHttpError(httpError(500)), true);
    assert.equal(isTransientHttpError(httpError(502)), true);
    assert.equal(isTransientHttpError(httpError(404)), false);
    assert.equal(isTransientHttpError(httpError(429)), false);
    assert.equal(isTransientHttpError(new Error('boom')), false);
  });
});
