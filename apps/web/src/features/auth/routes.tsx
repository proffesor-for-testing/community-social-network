import React from 'react';
import type { RouteObject } from 'react-router-dom';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';

export const authRoutes: RouteObject[] = [
  {
    path: 'login',
    element: <LoginForm />,
  },
  {
    path: 'register',
    element: <RegisterForm />,
  },
];
