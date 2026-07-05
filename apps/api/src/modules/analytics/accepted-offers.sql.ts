import { Prisma } from "@pms/db";

/**
 * The single predicate for "this offer counts toward placement CTC stats."
 * ACCEPTED only — revoke() overwrites status directly to REVOKED (never
 * leaves a separate "accepted but revoked" flag), so this alone already
 * excludes revoked offers; there is no second condition to get out of sync.
 * Shared between the recompute processor (this slice) and the drilldown
 * query (slice 19) so a KPI number and its underlying list can never drift
 * apart — one predicate, not two copies that could diverge.
 */
export const ACCEPTED_OFFER_PREDICATE = Prisma.sql`o.status = 'ACCEPTED'`;
