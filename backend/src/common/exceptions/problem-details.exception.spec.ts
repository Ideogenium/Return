import { NotFoundException } from './problem-details.exception.js';

describe('NotFoundException', () => {
  const typeOf = (resource: string): string =>
    (new NotFoundException(resource, 'id-1', '/v1/x').getResponse() as { type: string }).type;

  it.each([
    ['Loan', 'loan-not-found'],
    ['Item', 'item-not-found'],
    ['User', 'user-not-found'],
  ])('uses the lowercase resource name in the problem type (%s → %s)', (resource, slug) => {
    expect(typeOf(resource)).toBe(`https://api.return.app/errors/${slug}`);
  });

  it('kebab-cases a multi-word resource, as the contract does (DeviceToken → device-token-not-found)', () => {
    expect(typeOf('DeviceToken')).toBe('https://api.return.app/errors/device-token-not-found');
  });

  it('writes a readable detail for a multi-word resource', () => {
    const response = new NotFoundException('DeviceToken', 'tok-1', '/v1/x').getResponse() as {
      detail: string;
    };

    expect(response.detail).toBe("The device token with ID 'tok-1' does not exist.");
  });
});
