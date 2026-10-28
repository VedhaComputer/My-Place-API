import { PlaceRepository } from './repository';
import { PlaceDocument, PlaceCollisionReviewDocument, PlaceFilterQuery } from './types';
import { PlaceLevel, ReviewTicketStatus, VerificationDecision } from '../../shared/constants';
import { NotFoundError, HierarchyError } from '../../shared/errors/AppError';
import { AuthenticatedUser } from '../../middleware/authenticate';

export class PlaceService {
  constructor(private readonly repository: PlaceRepository = new PlaceRepository()) {}

  public getRepository(): PlaceRepository {
    return this.repository;
  }

  public async getPlaceById(id: string): Promise<PlaceDocument> {
    const place = await this.repository.findById(id);
    if (!place) {
      throw new NotFoundError(`Place with ID ${id}`);
    }
    return place;
  }

  public async getPlaceByCode(code: string): Promise<PlaceDocument> {
    const place = await this.repository.findByCode(code);
    if (!place) {
      throw new NotFoundError(`Place with Code ${code}`);
    }
    return place;
  }

  public async getHierarchyAncestors(placeId: string): Promise<PlaceDocument[]> {
    const ancestors: PlaceDocument[] = [];
    const visited = new Set<string>();
    let currentId: string | null = placeId;

    while (currentId) {
      if (visited.has(currentId)) {
        throw new HierarchyError(`Cyclic hierarchy detected at place ID '${currentId}'`);
      }
      visited.add(currentId);

      const place = await this.repository.findById(currentId);
      if (!place) break;
      ancestors.unshift(place);
      currentId = place.parentId;
    }

    return ancestors;
  }

  public async getChildren(parentId: string): Promise<PlaceDocument[]> {
    return this.repository.findChildren(parentId);
  }

  public async listPlaces(filter: PlaceFilterQuery): Promise<{ data: PlaceDocument[]; total: number }> {
    return this.repository.query(filter);
  }

  public async createPlace(
    input: {
      level: string;
      canonicalName: string;
      names: Array<{ language: string; name: string }>;
      parentId?: string | null;
      metadata?: Record<string, unknown>;
      _id?: string;
      code?: string;
    },
    user?: AuthenticatedUser
  ): Promise<PlaceDocument> {
    return this.repository.createPlace({
      ...input,
      level: input.level as PlaceLevel,
      createdBy: user?.userId || 'SYSTEM_ADMIN',
    });
  }

  public async updatePlace(
    placeId: string,
    updates: {
      canonicalName?: string;
      names?: Array<{ language: string; name: string }>;
      metadata?: Record<string, unknown>;
    },
    adminUser: AuthenticatedUser
  ): Promise<PlaceDocument> {
    return this.repository.updatePlace(placeId, updates, adminUser);
  }

  public async verifyPlace(
    placeId: string,
    input: {
      decision: VerificationDecision;
      evidence: string;
      comments?: string;
    },
    user: AuthenticatedUser
  ): Promise<PlaceDocument> {
    return this.repository.verifyPlace(placeId, input, user);
  }

  public async listCollisionTickets(status?: ReviewTicketStatus): Promise<PlaceCollisionReviewDocument[]> {
    return this.repository.listCollisionTickets(status);
  }

  public async resolveCollisionTicket(
    ticketId: string,
    targetStatus: ReviewTicketStatus,
    adminId: string,
    notes?: string
  ): Promise<PlaceCollisionReviewDocument> {
    return this.repository.resolveCollisionTicket(ticketId, targetStatus, adminId, notes);
  }
}
