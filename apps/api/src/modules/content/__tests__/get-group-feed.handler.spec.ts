import { describe, it, expect, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { UserId, Email, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  PublicationStatus,
  Visibility,
  GroupId,
} from '@csn/domain-content';
import { Profile, ProfileId, DisplayName } from '@csn/domain-profile';
import {
  GroupId as CommunityGroupId,
  Membership,
  MembershipId,
  MembershipRole,
} from '@csn/domain-community';
import { InMemoryPublicationRepository } from '@csn/infra-content';
import { InMemoryMembershipRepository } from '@csn/infra-community';
import { GetGroupFeedHandler } from '../queries/get-group-feed.handler';
import { GetGroupFeedQuery } from '../queries/get-group-feed.query';
import { GroupMembershipChecker } from '../services/group-membership-checker.service';

function makeGroupPost(
  author: UserId,
  groupId: string | null,
  text: string,
  createdAt: string,
): Publication {
  const at = Timestamp.fromDate(new Date(createdAt));
  return Publication.reconstitute(
    PublicationId.generate(),
    author,
    PublicationContent.create(text),
    Visibility.GROUP_ONLY,
    PublicationStatus.PUBLISHED,
    [],
    [],
    new Map<string, number>(),
    at,
    at,
    1,
    groupId ? GroupId.create(groupId) : null,
  );
}

class StubDiscussionRepo {
  async countActiveByPublicationIds(): Promise<Map<string, number>> {
    return new Map<string, number>();
  }
}

class StubProfileRepo {
  constructor(private readonly profiles: Map<string, Profile>) {}
  async findByMemberIds(ids: UserId[]): Promise<Map<string, Profile>> {
    const out = new Map<string, Profile>();
    for (const id of ids) {
      const p = this.profiles.get(id.value);
      if (p) out.set(id.value, p);
    }
    return out;
  }
}

describe('GetGroupFeedHandler', () => {
  let publications: InMemoryPublicationRepository;
  let memberships: InMemoryMembershipRepository;
  let handler: GetGroupFeedHandler;
  let group: CommunityGroupId;
  let member: UserId;
  let outsider: UserId;

  beforeEach(async () => {
    publications = new InMemoryPublicationRepository();
    memberships = new InMemoryMembershipRepository();
    group = CommunityGroupId.generate();
    member = UserId.generate();
    outsider = UserId.generate();

    const profiles = new Map<string, Profile>([
      [
        member.value,
        Profile.create(
          ProfileId.generate(),
          member,
          DisplayName.create('Group Member'),
          Email.create('group.member@test.local'),
        ),
      ],
    ]);

    handler = new GetGroupFeedHandler(
      publications as never,
      new StubProfileRepo(profiles) as never,
      new StubDiscussionRepo() as never,
      new GroupMembershipChecker(memberships as never),
    );

    await memberships.save(
      Membership.create(
        MembershipId.generate(),
        group,
        member,
        MembershipRole.MEMBER,
      ),
    );
  });

  it('should return the posts belonging to the group', async () => {
    // Arrange
    const post = makeGroupPost(member, group.value, 'in group', '2026-01-01T00:00:00Z');
    await publications.save(post);

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items.map((i) => i.id)).toEqual([post.id.value]);
  });

  it('should exclude posts from another group', async () => {
    // Arrange
    await publications.save(
      makeGroupPost(member, CommunityGroupId.generate().value, 'elsewhere', '2026-01-01T00:00:00Z'),
    );

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items).toEqual([]);
  });

  it('should exclude main-feed posts with no group', async () => {
    // Arrange
    await publications.save(makeGroupPost(member, null, 'personal', '2026-01-01T00:00:00Z'));

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items).toEqual([]);
  });

  it('should reject a reader who is not a member of the group', async () => {
    // Act / Assert
    await expect(
      handler.execute(new GetGroupFeedQuery(group.value, outsider.value)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should enrich items with the author display name', async () => {
    // Arrange
    await publications.save(
      makeGroupPost(member, group.value, 'hello', '2026-01-01T00:00:00Z'),
    );

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items[0]!.authorName).toBe('Group Member');
  });

  it('should expose the group id on each returned item', async () => {
    // Arrange
    await publications.save(
      makeGroupPost(member, group.value, 'hello', '2026-01-01T00:00:00Z'),
    );

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items[0]!.groupId).toBe(group.value);
  });

  it('should order the group feed newest first', async () => {
    // Arrange
    await publications.save(
      makeGroupPost(member, group.value, 'older', '2026-01-01T00:00:00Z'),
    );
    await publications.save(
      makeGroupPost(member, group.value, 'newer', '2026-01-02T00:00:00Z'),
    );

    // Act
    const result = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value),
    );

    // Assert
    expect(result.items.map((i) => i.content)).toEqual(['newer', 'older']);
  });

  it('should paginate the group feed with the returned cursor', async () => {
    // Arrange
    await publications.save(
      makeGroupPost(member, group.value, 'older', '2026-01-01T00:00:00Z'),
    );
    await publications.save(
      makeGroupPost(member, group.value, 'newer', '2026-01-02T00:00:00Z'),
    );
    const first = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value, undefined, 1),
    );

    // Act
    const second = await handler.execute(
      new GetGroupFeedQuery(group.value, member.value, first.nextCursor!, 1),
    );

    // Assert
    expect(second.items.map((i) => i.content)).toEqual(['older']);
  });
});
