import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  PublicationStatus,
  Mention,
} from '@csn/domain-content';
import { AggregateMapper } from '@csn/infra-shared';
import { PublicationEntity } from '../entities/publication.entity';
import { MentionEntity } from '../entities/mention.entity';
import { ReactionEntity } from '../entities/reaction.entity';

export interface PublicationPersistenceBundle {
  publication: PublicationEntity;
  mentions: MentionEntity[];
  reactions: ReactionEntity[];
}

export class PublicationMapper
  implements AggregateMapper<Publication, PublicationPersistenceBundle>
{
  toDomain(raw: PublicationPersistenceBundle): Publication {
    const { publication, mentions, reactions } = raw;

    const domainMentions = mentions.map((m) =>
      Mention.create(m.userId, m.position),
    );

    // Aggregate reactions into counts by type
    const reactionCounts = new Map<string, number>();
    for (const reaction of reactions) {
      const current = reactionCounts.get(reaction.type) ?? 0;
      reactionCounts.set(reaction.type, current + 1);
    }

    // mediaIds are not stored in publication_reactions/mentions tables;
    // placeholder empty array since the entity does not persist mediaIds separately yet
    const mediaIds: string[] = [];

    return Publication.reconstitute(
      PublicationId.create(publication.id),
      UserId.create(publication.authorId),
      PublicationContent.create(publication.content),
      Visibility.create(publication.visibility),
      PublicationStatus.create(publication.status),
      domainMentions,
      mediaIds,
      reactionCounts,
      Timestamp.fromDate(publication.createdAt),
      Timestamp.fromDate(publication.updatedAt),
      publication.version,
    );
  }

  toPersistence(domain: Publication): PublicationPersistenceBundle {
    const publicationEntity = new PublicationEntity();
    publicationEntity.id = domain.id.value;
    publicationEntity.authorId = domain.authorId.value;
    publicationEntity.content = domain.content.text;
    publicationEntity.status = domain.status.value;
    publicationEntity.visibility = domain.visibility.value;
    publicationEntity.createdAt = domain.createdAt.value;
    publicationEntity.updatedAt = domain.updatedAt.value;
    publicationEntity.version = domain.version;

    const mentionEntities = domain.mentions.map((mention) => {
      const entity = new MentionEntity();
      entity.publicationId = domain.id.value;
      entity.userId = mention.userId;
      entity.position = mention.position;
      return entity;
    });

    // Expand reaction counts into individual reaction entities.
    // Note: When persisting, we can only reconstruct the type + count;
    // individual user associations need to come from the ReactionEntity table directly.
    // This mapper is used for the round-trip from domain to entity.
    // For reaction entities, we do NOT re-create them from counts since
    // individual reactions track specific users. They are managed separately in the repository.
    const reactionEntities: ReactionEntity[] = [];

    return {
      publication: publicationEntity,
      mentions: mentionEntities,
      reactions: reactionEntities,
    };
  }
}
