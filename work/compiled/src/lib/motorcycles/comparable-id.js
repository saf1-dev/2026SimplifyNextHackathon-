"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeModel = normalizeModel;
exports.buildComparableGroupId = buildComparableGroupId;
const buckets_1 = require("./buckets");
function normalizeModel(model) {
    return model.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}
function buildComparableGroupId(listing) {
    return [
        listing.brand.toUpperCase(),
        normalizeModel(listing.model),
        listing.engineClass,
        (0, buckets_1.ccBucket)(listing.engineCc),
        (0, buckets_1.coeBucket)(listing.coeRemainingYears),
        (0, buckets_1.ageBucket)(listing.ageYears),
        (0, buckets_1.mileageBucket)(listing.mileageKm),
        listing.conditionGroup,
    ].join("|");
}
