import { useGroupMembers } from './useGroupMembers';
import { useAuthStore } from '../../../stores/auth.store';

/**
 * Whether the signed-in user appears in the group's member list.
 *
 * Drives the members-only composer and feed on the group page. While the member
 * list is loading `isMember` is false, so nothing members-only flashes for a
 * visitor who turns out not to be one.
 */
export function useIsGroupMember(groupId: string): {
  isMember: boolean;
  isLoading: boolean;
} {
  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading } = useGroupMembers(groupId);

  const isMember =
    !!currentUser &&
    !!data?.items.some((membership) => membership.memberId === currentUser.id);

  return { isMember, isLoading };
}
