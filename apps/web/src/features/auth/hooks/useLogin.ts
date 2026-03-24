import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import type { AuthTokensDto, CurrentUserDto, LoginDto } from '../../../api/types';
import { useAuthStore } from '../../../stores/auth.store';
import { useToastStore } from '../../../stores/toast.store';

interface LoginResponse extends AuthTokensDto {
  user: CurrentUserDto;
}

async function loginRequest(dto: LoginDto): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', dto);
  return data;
}

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  return useMutation<LoginResponse, ApiError, LoginDto>({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      login(data.accessToken, data.user);
      addToast('Welcome back!', 'success');
      navigate('/', { replace: true });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
