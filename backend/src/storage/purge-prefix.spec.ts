import { assertPurgePrefix } from './purge-prefix.js';

describe('assertPurgePrefix', () => {
  it.each(['users/u-1/', 'users/u-1/items/', 'users/u-1/items/i-1/'])(
    'accepts a prefix naming at least one specific folder under a root (%s)',
    (prefix) => {
      expect(() => assertPurgePrefix(prefix)).not.toThrow();
    },
  );

  it.each([
    ['', 'empty'],
    ['/', 'root'],
    ['users', 'no trailing slash'],
    ['users/', 'a whole root: every account'],
    ['items/', 'a whole root'],
    ['users/u-1', 'no trailing slash: would also match users/u-10…'],
    ['users//', 'empty segment'],
    ['users/./', 'dot segment'],
    ['users/../', 'parent segment'],
    ['users/u-1/../u-2/', 'parent segment'],
  ])('refuses "%s" (%s)', (prefix) => {
    expect(() => assertPurgePrefix(prefix)).toThrow(/unsafe storage prefix/);
  });
});
