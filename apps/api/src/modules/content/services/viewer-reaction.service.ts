import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReactionEntity } from '@csn/infra-content';

/**
 * Resolves which reaction (if any) the viewing user has left on a set of
 * publications. One batched query per page — no N+1.
 */
@Injectable()
export class ViewerReactionService {
  constructor(
    @InjectRepository(ReactionEntity)
    private readonly reactionRepository: Repository<ReactionEntity>,
  ) {}

  /**
   * @returns Map of publicationId → reaction type (e.g. 'LIKE') for the viewer.
   *          Empty map when there is no viewer or no publications.
   */
  async findByViewer(
    publicationIds: string[],
    viewerId?: string | null,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!viewerId || publicationIds.length === 0) {
      return result;
    }
    const rows = await this.reactionRepository.find({
      where: { publicationId: In(publicationIds), userId: viewerId },
      select: ['publicationId', 'type'],
    });
    for (const row of rows) {
      result.set(row.publicationId, row.type);
    }
    return result;
  }
}
