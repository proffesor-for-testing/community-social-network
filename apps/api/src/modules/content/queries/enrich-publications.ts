import { Publication, IDiscussionRepository } from '@csn/domain-content';
import { IProfileRepository } from '@csn/domain-profile';
import { UserId } from '@csn/domain-shared';
import { PostResponseDto } from '../dto/post-response.dto';
import { ViewerReactionService } from '../services/viewer-reaction.service';

export interface PublicationEnrichmentDeps {
  profileRepository: IProfileRepository;
  discussionRepository: IDiscussionRepository;
  viewerReactions?: ViewerReactionService;
}

/**
 * Turn a page of Publications into response DTOs, resolving author profiles,
 * comment counts and the viewer's own reactions in one batched round-trip each
 * (never one query per post).
 *
 * Shared by the personal feed, the Explore feed and the group feed so all three
 * return an identically enriched shape.
 */
export async function enrichPublications(
  publications: Publication[],
  viewerId: string | undefined,
  deps: PublicationEnrichmentDeps,
): Promise<PostResponseDto[]> {
  // Batch-fetch author profiles in a single round-trip so authorName /
  // authorAvatarUrl land on the DTO without N+1 queries.
  const uniqueAuthorIds = Array.from(
    new Set(publications.map((p) => p.authorId.value)),
  ).map((id) => UserId.create(id));
  const profileByMemberId =
    uniqueAuthorIds.length > 0
      ? await deps.profileRepository.findByMemberIds(uniqueAuthorIds)
      : new Map();

  // Batch-count active comments per post (one GROUP BY query, no N+1).
  const commentCountByPostId =
    publications.length > 0
      ? await deps.discussionRepository.countActiveByPublicationIds(
          publications.map((p) => p.id),
        )
      : new Map<string, number>();

  // Batch-fetch the viewer's own reactions so the FE can render toggle state.
  const viewerReactionByPostId = deps.viewerReactions
    ? await deps.viewerReactions.findByViewer(
        publications.map((p) => p.id.value),
        viewerId,
      )
    : new Map<string, string>();

  return publications.map((pub) => {
    const profile = profileByMemberId.get(pub.authorId.value);
    const author = profile
      ? {
          displayName: profile.displayName.value,
          avatarUrl: null, // Avatar URLs not yet served; placeholder for parity.
        }
      : undefined;
    return PostResponseDto.fromDomain(
      pub,
      commentCountByPostId.get(pub.id.value) ?? 0,
      author,
      viewerReactionByPostId.get(pub.id.value) ?? null,
    );
  });
}
