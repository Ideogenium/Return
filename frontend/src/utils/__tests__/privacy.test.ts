import { getPrivacyPolicyUrl } from '../privacy';

describe('getPrivacyPolicyUrl', () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });

  it('points at the dev API root without the /v1 suffix', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(getPrivacyPolicyUrl('fr')).toBe('http://localhost:3000/privacy?lang=fr');
  });

  it('strips /v1 from the production API URL', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://return-api.fly.dev/v1';
    expect(getPrivacyPolicyUrl('fr')).toBe('https://return-api.fly.dev/privacy?lang=fr');
  });

  it('requests the English page for en', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://return-api.fly.dev/v1';
    expect(getPrivacyPolicyUrl('en')).toBe('https://return-api.fly.dev/privacy?lang=en');
  });

  it('normalizes regional language tags', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://return-api.fly.dev/v1';
    expect(getPrivacyPolicyUrl('fr-FR')).toBe('https://return-api.fly.dev/privacy?lang=fr');
    expect(getPrivacyPolicyUrl('en-US')).toBe('https://return-api.fly.dev/privacy?lang=en');
  });

  it('falls back to fr for an unknown or missing language', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://return-api.fly.dev/v1';
    expect(getPrivacyPolicyUrl('de')).toBe('https://return-api.fly.dev/privacy?lang=fr');
    expect(getPrivacyPolicyUrl(undefined)).toBe('https://return-api.fly.dev/privacy?lang=fr');
  });

  it('leaves a base URL without /v1 unchanged and tolerates a trailing slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    expect(getPrivacyPolicyUrl('en')).toBe('https://api.example.com/privacy?lang=en');
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/v1/';
    expect(getPrivacyPolicyUrl('en')).toBe('https://api.example.com/privacy?lang=en');
  });

  it('does not strip a /v1 that is not the final path segment', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/v10';
    expect(getPrivacyPolicyUrl('en')).toBe('https://api.example.com/v10/privacy?lang=en');
  });
});
