import React, { Suspense, lazy } from 'react';
import { useUiStore } from '../stores/ui.store';
import { Button } from '../shared/components/atoms/Button';
import { Spinner } from '../shared/components/atoms/Spinner';

const ProfileSettings = lazy(() =>
  import('../features/profile/components/ProfileSettings').then((m) => ({
    default: m.ProfileSettings,
  })),
);
const NotificationPreferences = lazy(() =>
  import('../features/notifications/components/NotificationPreferences').then((m) => ({
    default: m.NotificationPreferences,
  })),
);
const TwoFactorSetup = lazy(() =>
  import('../features/admin/components/TwoFactorSetup').then((m) => ({
    default: m.TwoFactorSetup,
  })),
);

function Fallback() {
  return (
    <div className="flex min-h-[20vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      {/* Profile Settings */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Profile
        </h2>
        <Suspense fallback={<Fallback />}>
          <ProfileSettings />
        </Suspense>
      </section>

      {/* Appearance */}
      <section className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Appearance
        </h2>
        <div className="mt-3 flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTheme(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </section>

      {/* Notification Preferences */}
      <section>
        <Suspense fallback={<Fallback />}>
          <NotificationPreferences />
        </Suspense>
      </section>

      {/* Security - 2FA */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Security
        </h2>
        <Suspense fallback={<Fallback />}>
          <TwoFactorSetup />
        </Suspense>
      </section>
    </div>
  );
}
