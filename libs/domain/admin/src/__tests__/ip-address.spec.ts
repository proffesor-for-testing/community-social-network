import { describe, it, expect } from 'vitest';
import { IpAddress } from '../value-objects/ip-address';

describe('IpAddress Value Object', () => {
  describe('IPv4 validation', () => {
    it('should accept valid IPv4 addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '0.0.0.0',
        '255.255.255.255',
        '127.0.0.1',
        '172.16.0.1',
      ];

      for (const ip of validIPs) {
        const ipAddress = IpAddress.create(ip);
        expect(ipAddress.value).toBe(ip);
        expect(ipAddress.isIPv4()).toBe(true);
        expect(ipAddress.isIPv6()).toBe(false);
      }
    });

    it('should reject invalid IPv4 addresses', () => {
      const invalidIPs = [
        '256.1.1.1',
        '1.2.3.256',
        '1.2.3',
        '1.2.3.4.5',
        'abc.def.ghi.jkl',
        '192.168.1',
      ];

      for (const ip of invalidIPs) {
        expect(() => IpAddress.create(ip)).toThrow('Invalid IP address format');
      }
    });
  });

  describe('IPv6 validation', () => {
    it('should accept valid IPv6 addresses', () => {
      const validIPs = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        'fe80::1',
        '::1',
        '::',
        '2001:db8::',
        'fe80::a1:b2c3',
      ];

      for (const ip of validIPs) {
        const ipAddress = IpAddress.create(ip);
        expect(ipAddress.value).toBe(ip);
        expect(ipAddress.isIPv6()).toBe(true);
      }
    });

    it('should reject invalid IPv6 addresses', () => {
      const invalidIPs = [
        '2001:db8:85a3:0000:0000:8a2e:0370:7334:extra',
        'gggg::1',
        '12345::1',
      ];

      for (const ip of invalidIPs) {
        expect(() => IpAddress.create(ip)).toThrow('Invalid IP address format');
      }
    });
  });

  describe('general validation', () => {
    it('should reject empty string', () => {
      expect(() => IpAddress.create('')).toThrow('IP address must not be empty');
    });

    it('should reject whitespace-only string', () => {
      expect(() => IpAddress.create('   ')).toThrow('IP address must not be empty');
    });

    it('should trim whitespace from valid IPs', () => {
      const ipAddress = IpAddress.create('  192.168.1.1  ');
      expect(ipAddress.value).toBe('192.168.1.1');
    });
  });

  describe('toString', () => {
    it('should return the IP address string', () => {
      const ipAddress = IpAddress.create('10.0.0.1');
      expect(ipAddress.toString()).toBe('10.0.0.1');
    });
  });

  describe('equality', () => {
    it('should be equal for same IP address', () => {
      const ip1 = IpAddress.create('192.168.1.1');
      const ip2 = IpAddress.create('192.168.1.1');
      expect(ip1.equals(ip2)).toBe(true);
    });

    it('should not be equal for different IP addresses', () => {
      const ip1 = IpAddress.create('192.168.1.1');
      const ip2 = IpAddress.create('10.0.0.1');
      expect(ip1.equals(ip2)).toBe(false);
    });
  });
});
