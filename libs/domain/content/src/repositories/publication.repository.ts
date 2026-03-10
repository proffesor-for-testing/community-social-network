import { IRepository, UserId } from '@csn/domain-shared';
import { Publication } from '../aggregates/publication';
import { PublicationId } from '../value-objects/publication-id';

export interface IPublicationRepository
  extends IRepository<Publication, PublicationId> {
  findByAuthorId(authorId: UserId): Promise<Publication[]>;
}
