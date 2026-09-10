import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageKeys, sendMessage } from '../queries';
import type { DirectMessageDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<DirectMessageDto, ApiError, string>({
    mutationFn: (content: string) => sendMessage(conversationId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.thread(conversationId),
      });
      queryClient.invalidateQueries({ queryKey: messageKeys.list() });
    },
    onError: (error) => {
      addToast(parseApiError(error).message, 'error');
    },
  });
}
