import { describe, it, expect } from 'vitest';
import { PrivacySettings } from '../value-objects/privacy-settings';

describe('PrivacySettings', () => {
  describe('default', () => {
    it('should have public visibility', () => {
      const settings = PrivacySettings.default();
      expect(settings.profileVisibility).toBe('public');
    });

    it('should not show email by default', () => {
      const settings = PrivacySettings.default();
      expect(settings.showEmail).toBe(false);
    });

    it('should show location by default', () => {
      const settings = PrivacySettings.default();
      expect(settings.showLocation).toBe(true);
    });
  });

  describe('create', () => {
    it('should create with custom visibility', () => {
      const settings = PrivacySettings.create({
        profileVisibility: 'private',
        showEmail: true,
        showLocation: false,
      });

      expect(settings.profileVisibility).toBe('private');
      expect(settings.showEmail).toBe(true);
      expect(settings.showLocation).toBe(false);
    });

    it('should accept connections_only visibility', () => {
      const settings = PrivacySettings.create({
        profileVisibility: 'connections_only',
        showEmail: false,
        showLocation: true,
      });

      expect(settings.profileVisibility).toBe('connections_only');
    });

    it('should accept public visibility', () => {
      const settings = PrivacySettings.create({
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
      });

      expect(settings.profileVisibility).toBe('public');
    });

    it('should reject invalid visibility', () => {
      expect(() =>
        PrivacySettings.create({
          profileVisibility: 'unknown' as 'public',
          showEmail: false,
          showLocation: true,
        }),
      ).toThrow('Profile visibility must be one of');
    });
  });

  describe('equality', () => {
    it('should be equal with same props', () => {
      const a = PrivacySettings.create({
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
      });
      const b = PrivacySettings.create({
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
      });

      expect(a.equals(b)).toBe(true);
    });

    it('should not be equal with different props', () => {
      const a = PrivacySettings.create({
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
      });
      const b = PrivacySettings.create({
        profileVisibility: 'private',
        showEmail: false,
        showLocation: true,
      });

      expect(a.equals(b)).toBe(false);
    });

    it('should consider default equal to explicit public/false/true', () => {
      const defaultSettings = PrivacySettings.default();
      const explicitSettings = PrivacySettings.create({
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
      });

      expect(defaultSettings.equals(explicitSettings)).toBe(true);
    });
  });
});
