import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileKeys, uploadAvatar } from '../queries';
import type { ProfileDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useAvatarUpload() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ProfileDto, ApiError, File>({
    mutationFn: uploadAvatar,
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.me(), data);
      queryClient.invalidateQueries({ queryKey: profileKeys.all });
      addToast('Avatar updated successfully', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
