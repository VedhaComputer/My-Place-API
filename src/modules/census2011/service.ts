import { Census2011Repository } from './repository';
import { Census2011PlaceDocument, Census2011FilterQuery } from './types';
import { NotFoundError } from '../../shared/errors/AppError';

export class Census2011Service {
  constructor(private readonly repository: Census2011Repository = new Census2011Repository()) {}

  public async getPlaceById(id: string): Promise<Census2011PlaceDocument> {
    const place = await this.repository.findById(id);
    if (!place) {
      throw new NotFoundError(`Census 2011 place with ID ${id}`);
    }
    return place;
  }

  public async listPlaces(filter: Census2011FilterQuery = {}): Promise<{
    data: Census2011PlaceDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const result = await this.repository.query({ ...filter, page, limit });
    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    };
  }

  public async getChildren(
    parentId: string,
    filter: Census2011FilterQuery = {}
  ): Promise<{
    data: Census2011PlaceDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const parent = await this.repository.findById(parentId);
    if (!parent) {
      throw new NotFoundError(`Parent place with ID ${parentId}`);
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const result = await this.repository.query({ ...filter, parentId, page, limit });
    return {
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    };
  }

  public async getHierarchyAncestors(placeId: string): Promise<Census2011PlaceDocument[]> {
    const place = await this.repository.findById(placeId);
    if (!place) {
      throw new NotFoundError(`Census 2011 place with ID ${placeId}`);
    }
    return this.repository.findAncestors(placeId);
  }

  public getRepository(): Census2011Repository {
    return this.repository;
  }
}
