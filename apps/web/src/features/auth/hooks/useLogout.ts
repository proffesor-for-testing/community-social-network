import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useAuthStore } from '../../../stores/auth.store';
import { useNotificationStore } from '../../../stores/notification.store';
import { useToastStore } from '../../../stores/toast.store';

async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearNotifications = useNotificationStore((s) => s.clearNotifications);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<void, Error, void>({
    mutationFn: logoutRequest,
    onSettled: () => {
      // Always clear client state regardless of server response
      clearAuth();
      clearNotifications();
      queryClient.clear();
      addToast('You have been logged out.', 'info');
      navigate('/login', { replace: true });
    },
  });
}
