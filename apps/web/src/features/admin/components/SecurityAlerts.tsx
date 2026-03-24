import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../../shared/components/atoms/Badge';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { adminKeys, fetchSecurityAlerts, type SecurityAlertDto } from '../queries';

const severityVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'critical' || severity === 'high') {
    return (
      <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    );
  }
  if (severity === 'medium') {
    return (
      <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

export function SecurityAlerts() {
  const { data: alerts, isLoading, isError } = useQuery<SecurityAlertDto[]>({
    queryKey: adminKeys.securityAlerts(),
    queryFn: fetchSecurityAlerts,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load security alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Security Alerts
      </h1>

      {!alerts || alerts.length === 0 ? (
        <div className="card text-center">
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No security alerts. All systems normal.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={[
                'card flex items-start gap-3',
                alert.severity === 'critical'
                  ? 'border-red-300 dark:border-red-700'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="mt-0.5 shrink-0">
                <SeverityIcon severity={alert.severity} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant[alert.severity] ?? 'default'} size="sm">
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {alert.message}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
