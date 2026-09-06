import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { AnalyseRequest, DuplicateResult, ListingDraft, ListingObservation, ListingRecord } from "@motomoto/domain";
import { ListingDraftSchema, ListingRecordSchema } from "@motomoto/domain";
import { normalizeModel } from "@motomoto/valuation";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

export interface SaveListingResult { listing: ListingRecord; observation: ListingObservation; duplicateResult: DuplicateResult; }
export interface ListingRepository {
  list(): Promise<ListingRecord[]>;
  findById(id: string): Promise<ListingRecord | null>;
  save(request: AnalyseRequest): Promise<SaveListingResult>;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function duplicateFingerprint(draft: ListingDraft): string {
  return sha256([draft.marketplace, draft.sourceListingId ?? "", draft.canonicalUrl ?? "", draft.brand?.toUpperCase() ?? "", normalizeModel(draft.model), draft.engineCc ?? ""].join("|"));
}

export function classifyDuplicate(draft: ListingDraft, listings: ListingRecord[]): { result: DuplicateResult; match: ListingRecord | null } {
  const canonicalHash = sha256(draft.canonicalUrl ?? draft.originalUrl);
  const exact = listings.find((item) =>
    (!!draft.sourceListingId && item.marketplace === draft.marketplace && item.sourceListingId === draft.sourceListingId) || item.canonicalUrlHash === canonicalHash,
  );
  if (exact) return { result: "EXACT_DUPLICATE", match: exact };
  const possible = listings.find((item) => item.brand?.toUpperCase() === draft.brand?.toUpperCase() && item.normalizedModel === normalizeModel(draft.model) && item.engineCc === draft.engineCc && item.askingPriceSgd === draft.askingPriceSgd);
  return possible ? { result: "POSSIBLE_DUPLICATE", match: possible } : { result: "NEW_LISTING", match: null };
}

function createObservation(listingId: string, draft: ListingDraft, agentTrace: Array<{ action: string; outcome: string }>): ListingObservation {
  return {
    id: randomUUID(), listingId, listingStatus: draft.listingStatus, askingPriceSgd: draft.askingPriceSgd,
    priceType: draft.priceType, mileageKm: draft.mileageKm, coeExpiry: draft.coeExpiry, coeRemainingYears: draft.coeRemainingYears,
    descriptionText: draft.descriptionText, conditionEvidence: draft.conditionEvidence, conditionScore: draft.conditionScore,
    conditionGroup: draft.conditionGroup, extractionEvidence: draft.extractionEvidence, dataQualityFlags: draft.dataQualityFlags,
    capturedAt: draft.capturedAt, ingestionSource: draft.ingestionSource, descriptionHash: sha256(draft.descriptionText ?? ""), agentTrace,
  };
}

export class JsonListingRepository implements ListingRepository {
  constructor(private readonly filePath: string, private readonly seedPath?: string) {}

  private async readStore(): Promise<{ listings: ListingRecord[]; observations: ListingObservation[] }> {
    try {
      const data = JSON.parse(await readFile(this.filePath, "utf8"));
      return { listings: (data.listings ?? []).map((item: unknown) => ListingRecordSchema.parse(item)), observations: data.observations ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      let listings: ListingRecord[] = [];
      if (this.seedPath) {
        try {
          const seed = JSON.parse(await readFile(this.seedPath, "utf8"));
          listings = (Array.isArray(seed) ? seed : seed.listings ?? []).map((item: unknown) => ListingRecordSchema.parse(item));
        } catch (seedError) { if ((seedError as NodeJS.ErrnoException).code !== "ENOENT") throw seedError; }
      }
      return { listings, observations: [] };
    }
  }

  private async writeStore(store: { listings: ListingRecord[]; observations: ListingObservation[] }): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await rename(temporary, this.filePath);
  }

  async list(): Promise<ListingRecord[]> { return (await this.readStore()).listings; }
  async findById(id: string): Promise<ListingRecord | null> { return (await this.readStore()).listings.find((item) => item.id === id) ?? null; }

  async save(request: AnalyseRequest): Promise<SaveListingResult> {
    const store = await this.readStore();
    const draft = ListingDraftSchema.parse(request.reviewedDraft);
    const duplicate = classifyDuplicate(draft, store.listings);
    const id = duplicate.match?.id ?? randomUUID();
    const observation = createObservation(id, draft, [
      { action: "VALIDATE_REVIEWED_DRAFT", outcome: "SCHEMA_VALID" },
      { action: "DUPLICATE_CHECK", outcome: duplicate.result },
      { action: "PERSIST_OBSERVATION", outcome: "SAVED" },
    ]);
    const listing: ListingRecord = {
      ...draft, id, firstSeenAt: duplicate.match?.firstSeenAt ?? draft.capturedAt, lastSeenAt: draft.capturedAt,
      normalizedModel: normalizeModel(draft.model), canonicalUrlHash: sha256(draft.canonicalUrl ?? draft.originalUrl),
      duplicateFingerprint: duplicateFingerprint(draft), currentObservationId: observation.id,
    };
    if (duplicate.match) store.listings[store.listings.findIndex((item) => item.id === id)] = listing;
    else store.listings.push(listing);
    store.observations.push(observation);
    await this.writeStore(store);
    return { listing, observation, duplicateResult: duplicate.result };
  }
}

export class DynamoListingRepository implements ListingRepository {
  private readonly documentClient: DynamoDBDocumentClient;
  constructor(private readonly tableName: string, region = process.env.AWS_REGION ?? "us-east-1") {
    this.documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
  }
  async list(): Promise<ListingRecord[]> {
    const listings: ListingRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.documentClient.send(new ScanCommand({ TableName: this.tableName, FilterExpression: "entityType = :type", ExpressionAttributeValues: { ":type": "LISTING" }, ExclusiveStartKey: startKey }));
      listings.push(...(result.Items ?? []).map((item) => ListingRecordSchema.parse(item.payload)));
      startKey = result.LastEvaluatedKey;
    } while (startKey);
    return listings;
  }
  async findById(id: string): Promise<ListingRecord | null> {
    const result = await this.documentClient.send(new GetCommand({ TableName: this.tableName, Key: { pk: `LISTING#${id}`, sk: "CURRENT" } }));
    return result.Item ? ListingRecordSchema.parse(result.Item.payload) : null;
  }
  async save(request: AnalyseRequest): Promise<SaveListingResult> {
    const draft = ListingDraftSchema.parse(request.reviewedDraft);
    const duplicate = classifyDuplicate(draft, await this.list());
    const id = duplicate.match?.id ?? randomUUID();
    const observation = createObservation(id, draft, [{ action: "VALIDATE_REVIEWED_DRAFT", outcome: "SCHEMA_VALID" }, { action: "DUPLICATE_CHECK", outcome: duplicate.result }, { action: "PERSIST_OBSERVATION", outcome: "SAVED_DYNAMODB" }]);
    const listing: ListingRecord = { ...draft, id, firstSeenAt: duplicate.match?.firstSeenAt ?? draft.capturedAt, lastSeenAt: draft.capturedAt, normalizedModel: normalizeModel(draft.model), canonicalUrlHash: sha256(draft.canonicalUrl ?? draft.originalUrl), duplicateFingerprint: duplicateFingerprint(draft), currentObservationId: observation.id };
    await this.documentClient.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: { pk: `LISTING#${id}`, sk: "CURRENT", entityType: "LISTING", payload: listing, marketplace: listing.marketplace, status: listing.listingStatus, normalizedModel: listing.normalizedModel, lastSeenAt: listing.lastSeenAt } } },
      { Put: { TableName: this.tableName, Item: { pk: `LISTING#${id}`, sk: `OBS#${observation.capturedAt}#${observation.id}`, entityType: "OBSERVATION", payload: observation } } },
    ] }));
    return { listing, observation, duplicateResult: duplicate.result };
  }
}

let singleton: ListingRepository | null = null;
export function getRepository(): ListingRepository {
  if (singleton) return singleton;
  const seedCandidates = [resolve(process.cwd(), "data/seed-motorcycle-listings.json"), resolve(process.cwd(), "../../data/seed-motorcycle-listings.json")];
  const seedPath = seedCandidates.find((candidate) => existsSync(candidate)) ?? seedCandidates[0]!;
  singleton = process.env.MOTOMOTO_REPOSITORY === "dynamodb"
    ? new DynamoListingRepository(process.env.MOTOMOTO_TABLE_NAME ?? "motomoto-poc")
    : new JsonListingRepository(resolve(process.cwd(), process.env.MOTOMOTO_LOCAL_DATA_PATH ?? ".runtime/motomoto-local.json"), seedPath);
  return singleton;
}
export function resetRepositoryForTests(): void { singleton = null; }
