import { IRepository } from '@csn/domain-shared';
import { Discussion } from '../aggregates/discussion';
import { DiscussionId } from '../value-objects/discussion-id';
import { PublicationId } from '../value-objects/publication-id';

export interface IDiscussionRepository
  extends IRepository<Discussion, DiscussionId> {
  findByPublicationId(pubId: PublicationId): Promise<Discussion[]>;
}
