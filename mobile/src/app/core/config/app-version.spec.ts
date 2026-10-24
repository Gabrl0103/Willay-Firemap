import pkg from '../../../../package.json';
import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('is the version of package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});
