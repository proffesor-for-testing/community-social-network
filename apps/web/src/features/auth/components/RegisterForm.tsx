import React, { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useRegister';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import { getFieldError, parseApiError } from '../../../api/error-handler';

interface FormErrors {
  displayName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateForm(fields: {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!fields.displayName.trim()) {
    errors.displayName = 'Display name is required.';
  }
  if (!fields.username.trim()) {
    errors.username = 'Username is required.';
  } else if (!/^[a-zA-Z0-9_-]{3,30}$/.test(fields.username)) {
    errors.username =
      'Username must be 3-30 characters (letters, numbers, hyphens, underscores).';
  }
  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!fields.password) {
    errors.password = 'Password is required.';
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }
  if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export function RegisterForm() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientErrors, setClientErrors] = useState<FormErrors>({});

  const { mutate, isPending, error } = useRegister();
  const apiError = error ? parseApiError(error) : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors = validateForm({
      displayName,
      username,
      email,
      password,
      confirmPassword,
    });
    setClientErrors(errors);

    if (Object.keys(errors).length > 0) return;

    mutate({ email, username, password, displayName });
  };

  const fieldError = (field: keyof FormErrors) =>
    clientErrors[field] ?? getFieldError(apiError, field);

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Join the community today
        </p>
      </div>

      {apiError && !apiError.details && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          {apiError.message}
        </div>
      )}

      <FormField
        label="Display Name"
        name="displayName"
        required
        autoComplete="name"
        placeholder="Jane Doe"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        error={fieldError('displayName')}
      />

      <FormField
        label="Username"
        name="username"
        required
        autoComplete="username"
        placeholder="janedoe"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldError('username')}
      />

      <FormField
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError('email')}
      />

      <FormField
        label="Password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError('password')}
      />

      <FormField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Repeat your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldError('confirmPassword')}
      />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        Create account
      </Button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
