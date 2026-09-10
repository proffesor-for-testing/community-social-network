import { useQuery } from '@tanstack/react-query';
import {
  messageKeys,
  fetchConversations,
  type ConversationListPage,
} from '../queries';

/**
 * The viewer's inbox. Polls every 15s: there is no socket gateway in the API
 * yet, and the inbox tolerates being a few seconds stale.
 */
export function useConversations() {
  return useQuery<ConversationListPage>({
    queryKey: messageKeys.list(),
    queryFn: fetchConversations,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}
