import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileKeys, updateProfile } from '../queries';
import type { ProfileDto, UpdateProfileDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ProfileDto, ApiError, UpdateProfileDto>({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      addToast('Profile updated successfully', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
