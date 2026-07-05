import { OfferStatus, Slab } from "@pms/db";
import { OfferCapDefinition, ReEligibilityDefinition } from "@pms/types";

const SLAB_RANK: Record<Slab, number> = {
  NON_DREAM: 0,
  SUPER_DREAM: 1,
  DREAM: 2,
};

/** Permissive by design: absent an explicit RE_ELIGIBILITY policy, institutions default to allowing every upward transition (placed-in-non-dream can still sit for dream, per the master plan's own example). */
const DEFAULT_RE_ELIGIBILITY: ReEligibilityDefinition = {
  allowDreamAfterNonDream: true,
  allowSuperDreamAfterNonDream: true,
  allowDreamAfterSuperDream: true,
};

/** One-offer-per-slab-tier is the product default; only an explicit policy can turn it off in favor of a stricter one-offer-total cap. */
const DEFAULT_OFFER_CAP: OfferCapDefinition = { oneOfferPerSlabTier: true };

export interface ExistingOffer {
  slab: Slab | null;
  status: OfferStatus;
}

export interface OfferEligibilityInput {
  proposedSlab: Slab | null;
  existingOffers: ExistingOffer[];
  capPolicy: OfferCapDefinition | null;
  reEligibilityPolicy: ReEligibilityDefinition | null;
}

export interface OfferEligibilityResult {
  allowed: boolean;
  reason: string;
}

function isUpwardTransitionAllowed(
  from: Slab,
  to: Slab,
  policy: ReEligibilityDefinition,
): boolean {
  if (from === "NON_DREAM" && to === "SUPER_DREAM")
    return policy.allowSuperDreamAfterNonDream;
  if (from === "NON_DREAM" && to === "DREAM")
    return policy.allowDreamAfterNonDream;
  if (from === "SUPER_DREAM" && to === "DREAM")
    return policy.allowDreamAfterSuperDream;
  return false;
}

/**
 * Pure — no I/O. Callers (SP-18's offer creation, once it exists) resolve
 * the active policies and existing offers first, then ask this whether a
 * new offer at `proposedSlab` may be extended. Two independent gates:
 *
 * 1. Cap: does the student already hold an active (EXTENDED/ACCEPTED)
 *    offer that this new one would collide with, per the cap policy?
 * 2. Re-eligibility: has the student already ACCEPTED an offer at a tier
 *    this proposal doesn't clear, per the re-eligibility policy?
 */
export function checkOfferEligibility(
  input: OfferEligibilityInput,
): OfferEligibilityResult {
  const capPolicy = input.capPolicy ?? DEFAULT_OFFER_CAP;
  const reEligibilityPolicy =
    input.reEligibilityPolicy ?? DEFAULT_RE_ELIGIBILITY;
  const activeOffers = input.existingOffers.filter(
    (o) => o.status === "EXTENDED" || o.status === "ACCEPTED",
  );

  if (capPolicy.oneOfferPerSlabTier) {
    if (
      input.proposedSlab &&
      activeOffers.some((o) => o.slab === input.proposedSlab)
    ) {
      return {
        allowed: false,
        reason: `Student already holds an active offer in the ${input.proposedSlab} tier; one offer per slab tier is enforced`,
      };
    }
  } else if (activeOffers.length > 0) {
    return {
      allowed: false,
      reason:
        "Student already holds an active offer; this institution's offer cap allows only one offer total",
    };
  }

  const acceptedOffers = input.existingOffers.filter(
    (o) => o.status === "ACCEPTED",
  );
  if (acceptedOffers.length > 0 && input.proposedSlab) {
    const acceptedRanks = acceptedOffers.map((o) =>
      o.slab ? SLAB_RANK[o.slab] : -1,
    );
    const highestAcceptedRank = Math.max(...acceptedRanks);
    const highestAcceptedSlab = (Object.keys(SLAB_RANK) as Slab[]).find(
      (slab) => SLAB_RANK[slab] === highestAcceptedRank,
    )!;
    const proposedRank = SLAB_RANK[input.proposedSlab];

    if (proposedRank < highestAcceptedRank) {
      return {
        allowed: false,
        reason: `Student already accepted a ${highestAcceptedSlab} offer; cannot receive a lower-tier ${input.proposedSlab} offer`,
      };
    }
    if (proposedRank === highestAcceptedRank) {
      return {
        allowed: false,
        reason: `Student already accepted an offer in the ${input.proposedSlab} tier`,
      };
    }
    if (
      !isUpwardTransitionAllowed(
        highestAcceptedSlab,
        input.proposedSlab,
        reEligibilityPolicy,
      )
    ) {
      return {
        allowed: false,
        reason: `Re-eligibility policy does not allow moving from ${highestAcceptedSlab} to ${input.proposedSlab}`,
      };
    }
  }

  return { allowed: true, reason: "OK" };
}
