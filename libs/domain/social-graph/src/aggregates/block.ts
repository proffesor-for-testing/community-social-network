import { AggregateRoot, UserId, Timestamp } from '@csn/domain-shared';
import { BlockId } from '../value-objects/block-id';
import { CannotBlockSelfError } from '../errors/cannot-block-self.error';
import { MemberBlockedEvent } from '../events/member-blocked.event';
import { MemberUnblockedEvent } from '../events/member-unblocked.event';

export class Block extends AggregateRoot<BlockId> {
  private _blockerId: UserId;
  private _blockedId: UserId;
  private _createdAt: Timestamp;

  private constructor(
    id: BlockId,
    blockerId: UserId,
    blockedId: UserId,
    createdAt: Timestamp,
  ) {
    super(id);
    this._blockerId = blockerId;
    this._blockedId = blockedId;
    this._createdAt = createdAt;
  }

  public static create(
    id: BlockId,
    blockerId: UserId,
    blockedId: UserId,
  ): Block {
    if (blockerId.equals(blockedId)) {
      throw new CannotBlockSelfError();
    }

    const block = new Block(id, blockerId, blockedId, Timestamp.now());

    block.addDomainEvent(
      new MemberBlockedEvent(
        id.value,
        blockerId.value,
        blockedId.value,
      ),
    );

    return block;
  }

  /**
   * Reconstitute a Block from persistence without emitting events.
   */
  public static reconstitute(
    id: BlockId,
    blockerId: UserId,
    blockedId: UserId,
    createdAt: Timestamp,
    version: number,
  ): Block {
    const block = new Block(id, blockerId, blockedId, createdAt);
    block.setVersion(version);
    return block;
  }

  public unblock(): void {
    this.incrementVersion();

    this.addDomainEvent(
      new MemberUnblockedEvent(
        this.id.value,
        this._blockerId.value,
        this._blockedId.value,
      ),
    );
  }

  public get blockerId(): UserId {
    return this._blockerId;
  }

  public get blockedId(): UserId {
    return this._blockedId;
  }

  public get createdAt(): Timestamp {
    return this._createdAt;
  }
}
