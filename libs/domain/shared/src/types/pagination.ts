export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGINATION: Readonly<PaginationParams> = {
  page: 1,
  pageSize: 20,
};
