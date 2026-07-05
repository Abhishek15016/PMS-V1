import { checkOfferEligibility, ExistingOffer } from "./offer-eligibility.util";

function offers(...entries: ExistingOffer[]): ExistingOffer[] {
  return entries;
}

describe("checkOfferEligibility", () => {
  describe("default policy (oneOfferPerSlabTier: true, all upward transitions allowed)", () => {
    it("allows a first offer in any slab", () => {
      const result = checkOfferEligibility({
        proposedSlab: "NON_DREAM",
        existingOffers: [],
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });

    it("blocks a second active offer in the same slab tier", () => {
      const result = checkOfferEligibility({
        proposedSlab: "NON_DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "EXTENDED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/one offer per slab tier/i);
    });

    it("allows a second offer in a different slab tier (no accepted offer yet)", () => {
      const result = checkOfferEligibility({
        proposedSlab: "DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "EXTENDED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });

    it("ignores REJECTED/REVOKED offers entirely for the cap check", () => {
      const result = checkOfferEligibility({
        proposedSlab: "NON_DREAM",
        existingOffers: offers(
          { slab: "NON_DREAM", status: "REJECTED" },
          { slab: "NON_DREAM", status: "REVOKED" },
        ),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });

    it("placed-in-non-dream can still receive a dream offer (the master plan's own example)", () => {
      const result = checkOfferEligibility({
        proposedSlab: "DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });

    it("placed-in-non-dream can still receive a super-dream offer", () => {
      const result = checkOfferEligibility({
        proposedSlab: "SUPER_DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });

    it("placed-in-dream cannot receive a lower-tier offer", () => {
      const result = checkOfferEligibility({
        proposedSlab: "NON_DREAM",
        existingOffers: offers({ slab: "DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/lower-tier/i);
    });

    it("cannot receive another offer in the exact tier already accepted", () => {
      const result = checkOfferEligibility({
        proposedSlab: "SUPER_DREAM",
        existingOffers: offers({ slab: "SUPER_DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("oneOfferPerSlabTier: false (strict one-offer-total policy)", () => {
    it("blocks any second active offer regardless of slab", () => {
      const result = checkOfferEligibility({
        proposedSlab: "DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "EXTENDED" }),
        capPolicy: { oneOfferPerSlabTier: false },
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/one offer total/i);
    });

    it("allows a first offer", () => {
      const result = checkOfferEligibility({
        proposedSlab: "NON_DREAM",
        existingOffers: [],
        capPolicy: { oneOfferPerSlabTier: false },
        reEligibilityPolicy: null,
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("restrictive re-eligibility policy", () => {
    it("blocks an upward transition the policy explicitly disallows", () => {
      const result = checkOfferEligibility({
        proposedSlab: "DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: {
          allowDreamAfterNonDream: false,
          allowSuperDreamAfterNonDream: true,
          allowDreamAfterSuperDream: true,
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/re-eligibility policy/i);
    });

    it("allows a different upward transition the policy does permit", () => {
      const result = checkOfferEligibility({
        proposedSlab: "SUPER_DREAM",
        existingOffers: offers({ slab: "NON_DREAM", status: "ACCEPTED" }),
        capPolicy: null,
        reEligibilityPolicy: {
          allowDreamAfterNonDream: false,
          allowSuperDreamAfterNonDream: true,
          allowDreamAfterSuperDream: true,
        },
      });
      expect(result.allowed).toBe(true);
    });

    it("blocks all upward movement when every flag is false", () => {
      const noUpgrades = {
        allowDreamAfterNonDream: false,
        allowSuperDreamAfterNonDream: false,
        allowDreamAfterSuperDream: false,
      };
      expect(
        checkOfferEligibility({
          proposedSlab: "DREAM",
          existingOffers: offers({ slab: "SUPER_DREAM", status: "ACCEPTED" }),
          capPolicy: null,
          reEligibilityPolicy: noUpgrades,
        }).allowed,
      ).toBe(false);
    });
  });
});
