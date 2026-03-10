import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  DiscussionContent,
  DiscussionStatus,
} from '@csn/domain-content';
import { AggregateMapper } from '@csn/infra-shared';
import { DiscussionEntity } from '../entities/discussion.entity';

export class DiscussionMapper
  implements AggregateMapper<Discussion, DiscussionEntity>
{
  toDomain(raw: DiscussionEntity): Discussion {
    return Discussion.reconstitute(
      DiscussionId.create(raw.id),
      PublicationId.create(raw.publicationId),
      UserId.create(raw.authorId),
      DiscussionContent.create(raw.content),
      raw.parentId ? DiscussionId.create(raw.parentId) : null,
      DiscussionStatus.create(raw.status),
      Timestamp.fromDate(raw.createdAt),
      raw.version,
    );
  }

  toPersistence(domain: Discussion): DiscussionEntity {
    const entity = new DiscussionEntity();
    entity.id = domain.id.value;
    entity.publicationId = domain.publicationId.value;
    entity.authorId = domain.authorId.value;
    entity.parentId = domain.parentId ? domain.parentId.value : null;
    entity.content = domain.content.text;
    entity.status = domain.status.value;
    entity.createdAt = domain.createdAt.value;
    entity.version = domain.version;
    return entity;
  }
}
