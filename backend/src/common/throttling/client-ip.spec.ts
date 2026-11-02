import { resolveClientIp } from './client-ip.js';

describe('resolveClientIp', () => {
  it('reads the client IP from the configured header (the Fly edge sets Fly-Client-IP)', () => {
    const req = { ip: '172.16.0.2', headers: { 'fly-client-ip': '203.0.113.7' } };
    expect(resolveClientIp(req, 'Fly-Client-IP')).toBe('203.0.113.7');
  });

  it('accepts an IPv6 address and trims the header value', () => {
    const req = { ip: '172.16.0.2', headers: { 'fly-client-ip': ' 2001:db8::1 ' } };
    expect(resolveClientIp(req, 'fly-client-ip')).toBe('2001:db8::1');
  });

  it('falls back to req.ip when the header is missing or is not an IP address', () => {
    expect(resolveClientIp({ ip: '198.51.100.4', headers: {} }, 'fly-client-ip')).toBe(
      '198.51.100.4',
    );
    expect(
      resolveClientIp(
        { ip: '198.51.100.4', headers: { 'fly-client-ip': 'not-an-ip' } },
        'fly-client-ip',
      ),
    ).toBe('198.51.100.4');
  });

  it('ignores the header when none is configured, so a client cannot choose its own bucket', () => {
    const req = { ip: '198.51.100.4', headers: { 'fly-client-ip': '203.0.113.7' } };
    expect(resolveClientIp(req, undefined)).toBe('198.51.100.4');
  });

  it('uses the first value of a repeated header', () => {
    const req = {
      ip: '198.51.100.4',
      headers: { 'fly-client-ip': ['203.0.113.7', '203.0.113.8'] },
    };
    expect(resolveClientIp(req, 'fly-client-ip')).toBe('203.0.113.7');
  });
});
