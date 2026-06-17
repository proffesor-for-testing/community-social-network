import React, { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useAuthStore } from '../../../stores/auth.store';
import { useToastStore } from '../../../stores/toast.store';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import type { CurrentUserDto } from '../../../api/types';

interface AdminLoginResult {
  accessToken: string;
  requiresTwoFactor: boolean;
  adminId: string;
}

async function adminLoginRequest(dto: { email: string; password: string }) {
  const { data } = await apiClient.post<AdminLoginResult>('/admin/auth/login', dto);
  return data;
}

async function fetchSelf(token: string): Promise<CurrentUserDto> {
  const { data } = await apiClient.get<{
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
  }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  return {
    id: data.id,
    email: data.email,
    username: data.email.split('@')[0] ?? data.id,
    displayName: data.displayName,
    role: 'admin',
    createdAt: data.createdAt,
  };
}

export function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const { mutate, isPending, error } = useMutation<
    AdminLoginResult,
    ApiError,
    { email: string; password: string }
  >({
    mutationFn: adminLoginRequest,
    onSuccess: async (data) => {
      try {
        const user = await fetchSelf(data.accessToken);
        login(data.accessToken, user);
        addToast('Welcome, admin', 'success');
        navigate('/admin', { replace: true });
      } catch {
        addToast('Signed in, but could not load profile', 'error');
      }
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      addToast(parsed.message, 'error');
    },
  });

  const apiError = error ? parseApiError(error) : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-labelledby="admin-login-heading">
      <div className="text-center">
        <h1 id="admin-login-heading" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Admin sign in
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Restricted access — admin credentials required.
        </p>
      </div>

      {apiError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          {apiError.message}
        </div>
      )}

      <FormField
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="admin@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Enter your admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        Sign in to admin
      </Button>
    </form>
  );
}
