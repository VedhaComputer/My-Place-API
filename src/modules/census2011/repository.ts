import mongoose from 'mongoose';
import { Census2011PlaceModel, Census2011QuarantineModel, Census2011UrbanSummaryModel } from './census2011.model';
import { Census2011PlaceDocument, Census2011QuarantineDocument, Census2011UrbanSummaryDocument, Census2011FilterQuery } from './types';
import { toCanonicalLower } from '../../shared/utils/unicode';
import { DatabaseConnectionError } from '../../shared/errors/AppError';

export class Census2011Repository {
  private inMemoryMode = false;
  private inMemoryPlaces = new Map<string, Census2011PlaceDocument>();
  private inMemoryQuarantine = new Map<string, Census2011QuarantineDocument>();
  private inMemoryUrban = new Map<string, Census2011UrbanSummaryDocument>();

  /**
   * Asserts database connection readiness when in-memory mode is not explicitly enabled.
   * Prevents database outages from masking as false empty responses.
   */
  private ensureConnection(): void {
    if (this.inMemoryMode) {
      return;
    }
    if (mongoose.connection.readyState !== 1) {
      throw new DatabaseConnectionError('Database connection unavailable');
    }
  }

  /**
   * Enables in-memory mock mode for zero-database unit testing and dry-run assertions.
   */
  public enableInMemoryMode(
    places: Census2011PlaceDocument[] = [],
    quarantine: Census2011QuarantineDocument[] = [],
    urban: Census2011UrbanSummaryDocument[] = []
  ): void {
    this.inMemoryMode = true;
    this.inMemoryPlaces.clear();
    this.inMemoryQuarantine.clear();
    this.inMemoryUrban.clear();

    for (const p of places) this.inMemoryPlaces.set(p._id, p);
    for (const q of quarantine) this.inMemoryQuarantine.set(q._id, q);
    for (const u of urban) this.inMemoryUrban.set(u._id, u);
  }

  public disableInMemoryMode(): void {
    this.inMemoryMode = false;
    this.inMemoryPlaces.clear();
    this.inMemoryQuarantine.clear();
    this.inMemoryUrban.clear();
  }

  public isInMemoryModeEnabled(): boolean {
    return this.inMemoryMode;
  }

  public async findById(id: string): Promise<Census2011PlaceDocument | null> {
    if (this.inMemoryMode) {
      return this.inMemoryPlaces.get(id) ?? null;
    }
    this.ensureConnection();
    return Census2011PlaceModel.findById(id).lean<Census2011PlaceDocument>();
  }

  public async findChildren(parentId: string): Promise<Census2011PlaceDocument[]> {
    if (this.inMemoryMode) {
      return Array.from(this.inMemoryPlaces.values()).filter((p) => p.parentId === parentId);
    }
    this.ensureConnection();
    return Census2011PlaceModel.find({ parentId }).lean<Census2011PlaceDocument[]>();
  }

  public async findByCensusCode(censusCode: string): Promise<Census2011PlaceDocument | null> {
    if (this.inMemoryMode) {
      return Array.from(this.inMemoryPlaces.values()).find((p) => p.censusCode === censusCode) ?? null;
    }
    this.ensureConnection();
    return Census2011PlaceModel.findOne({ censusCode }).lean<Census2011PlaceDocument>();
  }

  public async findQuarantineById(id: string): Promise<Census2011QuarantineDocument | null> {
    if (this.inMemoryMode) {
      return this.inMemoryQuarantine.get(id) ?? null;
    }
    this.ensureConnection();
    return Census2011QuarantineModel.findById(id).lean<Census2011QuarantineDocument>();
  }

  public async findQuarantinedByParent(parentId: string): Promise<Census2011QuarantineDocument[]> {
    if (this.inMemoryMode) {
      return Array.from(this.inMemoryQuarantine.values()).filter((q) => q.parentId === parentId);
    }
    this.ensureConnection();
    return Census2011QuarantineModel.find({ parentId }).lean<Census2011QuarantineDocument[]>();
  }

  public async findUrbanSummaries(): Promise<Census2011UrbanSummaryDocument[]> {
    if (this.inMemoryMode) {
      return Array.from(this.inMemoryUrban.values());
    }
    this.ensureConnection();
    return Census2011UrbanSummaryModel.find().lean<Census2011UrbanSummaryDocument[]>();
  }

  public async countPlaces(): Promise<number> {
    if (this.inMemoryMode) {
      return this.inMemoryPlaces.size;
    }
    this.ensureConnection();
    return Census2011PlaceModel.countDocuments();
  }

  public async countQuarantined(): Promise<number> {
    if (this.inMemoryMode) {
      return this.inMemoryQuarantine.size;
    }
    this.ensureConnection();
    return Census2011QuarantineModel.countDocuments();
  }

  public async countUrbanSummaries(): Promise<number> {
    if (this.inMemoryMode) {
      return this.inMemoryUrban.size;
    }
    this.ensureConnection();
    return Census2011UrbanSummaryModel.countDocuments();
  }

  public async query(filter: Census2011FilterQuery = {}): Promise<{ data: Census2011PlaceDocument[]; total: number }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    if (this.inMemoryMode) {
      let filtered = Array.from(this.inMemoryPlaces.values());
      if (filter.parentId !== undefined) {
        filtered = filtered.filter((p) => p.parentId === filter.parentId);
      }
      if (filter.level) {
        filtered = filtered.filter((p) => p.level === filter.level);
      }
      if (filter.censusCode) {
        filtered = filtered.filter((p) => p.censusCode === filter.censusCode);
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.canonicalNameLower.includes(s) ||
            p.names.some((n) => n.name.toLowerCase().includes(s))
        );
      }
      const total = filtered.length;
      const data = filtered.slice(skip, skip + limit);
      return { data, total };
    }

    this.ensureConnection();

    const queryObj: Record<string, unknown> = {};
    if (filter.parentId !== undefined) queryObj.parentId = filter.parentId;
    if (filter.level) queryObj.level = filter.level;
    if (filter.censusCode) queryObj.censusCode = filter.censusCode;
    if (filter.search) {
      const lower = toCanonicalLower(filter.search);
      queryObj.$or = [
        { canonicalNameLower: { $regex: lower, $options: 'i' } },
        { 'names.name': { $regex: filter.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Census2011PlaceModel.find(queryObj).skip(skip).limit(limit).lean<Census2011PlaceDocument[]>(),
      Census2011PlaceModel.countDocuments(queryObj),
    ]);

    return { data, total };
  }

  public async findAncestors(placeId: string): Promise<Census2011PlaceDocument[]> {
    if (!this.inMemoryMode) {
      this.ensureConnection();
    }
    const ancestors: Census2011PlaceDocument[] = [];
    let currentId: string | null = placeId;

    while (currentId) {
      const place = await this.findById(currentId);
      if (!place) break;
      ancestors.unshift(place);
      currentId = place.parentId;
    }

    return ancestors;
  }
}
