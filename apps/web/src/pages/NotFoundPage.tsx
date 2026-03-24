import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/components/atoms/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Page not found
      </h1>
      <p className="max-w-md text-gray-600 dark:text-gray-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button variant="primary">Go home</Button>
      </Link>
    </div>
  );
}
