import React, { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { enable2FA, verify2FA } from '../queries';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function TwoFactorSetup() {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState<'initial' | 'verify' | 'done'>('initial');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const enableMutation = useMutation<{ qrCodeUrl: string; secret: string }, ApiError, void>({
    mutationFn: enable2FA,
    onSuccess: (data) => {
      setQrCodeUrl(data.qrCodeUrl);
      setSecret(data.secret);
      setStep('verify');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const verifyMutation = useMutation<void, ApiError, string>({
    mutationFn: verify2FA,
    onSuccess: () => {
      setStep('done');
      addToast('Two-factor authentication enabled!', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const handleVerify = (e: FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;
    verifyMutation.mutate(verificationCode.trim());
  };

  if (step === 'done') {
    return (
      <div className="card text-center">
        <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
        <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Two-Factor Authentication Enabled
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your account is now protected with 2FA.
        </p>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Verify Two-Factor Authentication
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.).
        </p>

        {qrCodeUrl && (
          <div className="flex justify-center">
            <img
              src={qrCodeUrl}
              alt="2FA QR Code"
              className="h-48 w-48 rounded-lg border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}

        <div className="rounded-lg bg-gray-50 p-3 dark:bg-surface-dark-tertiary">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manual entry key:
          </p>
          <code className="mt-1 block break-all text-sm font-mono text-gray-900 dark:text-gray-100">
            {secret}
          </code>
        </div>

        <form onSubmit={handleVerify} className="space-y-3">
          <FormField
            label="Verification Code"
            name="code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            pattern="[0-9]*"
            required
          />
          <Button type="submit" loading={verifyMutation.isPending} disabled={verificationCode.length < 6}>
            Verify and Enable
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Two-Factor Authentication
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Add an extra layer of security to your account by requiring a verification
        code from your authenticator app when signing in.
      </p>
      <Button
        onClick={() => enableMutation.mutate()}
        loading={enableMutation.isPending}
      >
        Set Up 2FA
      </Button>
    </div>
  );
}
