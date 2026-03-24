import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import {
  notificationKeys,
  fetchNotificationPreferences,
  updateNotificationPreference,
} from '../queries';
import type { NotificationPreferenceDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function NotificationPreferences() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: preferences, isLoading, isError } = useQuery<NotificationPreferenceDto[]>({
    queryKey: notificationKeys.preferences(),
    queryFn: fetchNotificationPreferences,
    staleTime: 5 * 60 * 1000,
  });

  const toggleMutation = useMutation<
    NotificationPreferenceDto,
    ApiError,
    { id: string; enabled: boolean }
  >({
    mutationFn: ({ id, enabled }) => updateNotificationPreference(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">
        Failed to load notification preferences.
      </p>
    );
  }

  if (!preferences || preferences.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No notification preferences configured.
      </p>
    );
  }

  // Group preferences by channel
  const grouped = preferences.reduce<Record<string, NotificationPreferenceDto[]>>(
    (acc, pref) => {
      const channel = pref.channel;
      if (!acc[channel]) acc[channel] = [];
      acc[channel].push(pref);
      return acc;
    },
    {},
  );

  const channelLabels: Record<string, string> = {
    in_app: 'In-App',
    email: 'Email',
    push: 'Push',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Notification Preferences
      </h2>

      {Object.entries(grouped).map(([channel, prefs]) => (
        <div key={channel} className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {channelLabels[channel] ?? channel}
          </h3>

          {prefs.map((pref) => (
            <div
              key={pref.id}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {pref.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={pref.enabled}
                onClick={() =>
                  toggleMutation.mutate({ id: pref.id, enabled: !pref.enabled })
                }
                disabled={toggleMutation.isPending}
                className={[
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
                  pref.enabled
                    ? 'bg-brand-600 dark:bg-brand-500'
                    : 'bg-gray-200 dark:bg-gray-600',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200',
                    pref.enabled ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
