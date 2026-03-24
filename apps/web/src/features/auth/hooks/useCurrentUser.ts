import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { CurrentUserDto } from '../../../api/types';
import { useAuthStore } from '../../../stores/auth.store';

async function fetchCurrentUser(): Promise<CurrentUserDto> {
  const { data } = await apiClient.get<CurrentUserDto>('/auth/me');
  return data;
}

export const CURRENT_USER_QUERY_KEY = ['auth', 'currentUser'] as const;

/**
 * Fetches the current user profile. Only runs when an access token is present.
 * On success, syncs the user object into the auth store.
 */
export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery<CurrentUserDto>({
    queryKey: [...CURRENT_USER_QUERY_KEY],
    queryFn: fetchCurrentUser,
    enabled: !!accessToken,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    select: (data) => {
      // Keep store in sync whenever the query resolves
      setUser(data);
      return data;
    },
  });
}
