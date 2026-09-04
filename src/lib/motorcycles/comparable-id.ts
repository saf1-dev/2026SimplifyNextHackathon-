import { ageBucket, ccBucket, coeBucket, mileageBucket } from "./buckets";
import type { MotorcycleListing } from "./types";

export function normalizeModel(model: string): string {
  return model.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function buildComparableGroupId(listing: Pick<MotorcycleListing,
  "brand" | "model" | "engineClass" | "engineCc" | "coeRemainingYears" | "ageYears" | "mileageKm" | "conditionGroup"
>): string {
  return [
    listing.brand.toUpperCase(),
    normalizeModel(listing.model),
    listing.engineClass,
    ccBucket(listing.engineCc),
    coeBucket(listing.coeRemainingYears),
    ageBucket(listing.ageYears),
    mileageBucket(listing.mileageKm),
    listing.conditionGroup,
  ].join("|");
}
