import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@csn/domain-shared';
import { IGroupRepository, Group } from '@csn/domain-community';
import { GROUP_REPOSITORY } from '@csn/infra-community';
import { SearchGroupsQuery } from './search-groups.query';

@Injectable()
export class SearchGroupsHandler {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
  ) {}

  async execute(query: SearchGroupsQuery): Promise<PaginatedResult<Group>> {
    return this.groupRepo.search(query.searchQuery, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
