import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import type { AuthTokensDto, CurrentUserDto, RegisterDto } from '../../../api/types';
import { useAuthStore } from '../../../stores/auth.store';
import { useToastStore } from '../../../stores/toast.store';

interface RegisterResponse extends AuthTokensDto {
  user: CurrentUserDto;
}

async function registerRequest(dto: RegisterDto): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>(
    '/auth/register',
    dto,
  );
  return data;
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  return useMutation<RegisterResponse, ApiError, RegisterDto>({
    mutationFn: registerRequest,
    onSuccess: (data) => {
      login(data.accessToken, data.user);
      addToast('Account created successfully!', 'success');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
