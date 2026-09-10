import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { messageKeys, startConversation } from '../queries';
import type { ConversationDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

/**
 * Opens (or reuses) the conversation with a member and navigates to it.
 * Used by the "Message" button on a profile.
 */
export function useStartConversation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ConversationDto, ApiError, string>({
    mutationFn: startConversation,
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.list() });
      navigate(`/messages/${conversation.id}`);
    },
    onError: (error) => {
      addToast(parseApiError(error).message, 'error');
    },
  });
}
