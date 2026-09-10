import React from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { useStartConversation } from '../hooks/useStartConversation';

interface MessageButtonProps {
  memberId: string;
}

/** Opens (or reuses) the conversation with a member and navigates to it. */
export function MessageButton({ memberId }: MessageButtonProps) {
  const { mutate, isPending } = useStartConversation();

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={() => mutate(memberId)}
      loading={isPending}
    >
      Message
    </Button>
  );
}
