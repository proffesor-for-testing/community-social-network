import { useMutation, useQueryClient } from '@tanstack/react-query';
import { feedKeys, createPublication } from '../queries';
import type { PublicationDto, CreatePublicationDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useCreatePost() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<PublicationDto, ApiError, CreatePublicationDto>({
    mutationFn: createPublication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKeys.all });
      addToast('Post created!', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });
}
