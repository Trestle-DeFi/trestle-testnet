import { isAddress, parseUnits, type Address } from "viem";

/**
 * Client-side form validation shared by the marketplace + RWA admin views.
 *
 * These helpers mirror the on-chain guards so users get a clear message instead
 * of a reverted/undecodable transaction (and so `parseUnits` never throws from a
 * click handler). See AUDIT-REPORT.md § Frontend Audit:
 *   - Marketplace: "No client-side validation on listing metadata before on-chain submission"
 *   - RWA: "No address format validation on whitelist input fields"
 */

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// Shorthands the RWA admin form documents as the "disable token gating" sentinel.
const ZERO_ADDRESS_SENTINELS = ["0", "0x0", "0x00", "0x000"];

/**
 * Parse a human-readable decimal amount into base units.
 * Returns `null` (instead of throwing) when the input is empty, negative,
 * non-numeric or otherwise not parseable at the requested precision.
 */
export function safeParseUnits(value: string, decimals = 18): bigint | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed.startsWith("-")) return null;
  // Reject "1.2.3", "1e5", ".", etc. before handing the value to viem.
  if (trimmed === "." || !/^\d*\.?\d*$/.test(trimmed)) return null;
  // viem silently rounds excess precision (0.1234567 @6dp -> 123457n); reject instead
  // so a user's amount is never rounded without them noticing.
  const fraction = trimmed.includes(".") ? trimmed.split(".")[1] : "";
  if (fraction.length > decimals) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

/** True when `value` parses to a strictly positive amount (on-chain guard: price > 0). */
export function isPositiveAmount(value: string, decimals = 18): boolean {
  const parsed = safeParseUnits(value, decimals);
  return parsed !== null && parsed > 0n;
}

export type PricingMode = "fixed" | "dutch";

export interface ListingDraft {
  metadataURI: string;
  pricingMode: PricingMode;
  fixedPrice?: string;
  startPrice?: string;
  reservePrice?: string;
  durationHrs?: string;
  decimals?: number;
}

/**
 * Validate a marketplace listing draft before submitting it on-chain.
 *
 * Mirrors `DigitalGoods.listFixed` (price > 0) and `DigitalGoods.listDutch`
 * (`DutchAuctionLib.validate`: startPrice > reservePrice && duration != 0) and
 * additionally requires the metadata URI the audit flagged as unvalidated.
 *
 * @returns the first human-readable error, or `null` when the draft is submittable.
 */
export function validateListingDraft(draft: ListingDraft): string | null {
  const decimals = draft.decimals ?? 18;

  if (!draft.metadataURI?.trim()) return "Metadata URI is required.";

  if (draft.pricingMode === "fixed") {
    if (!isPositiveAmount(draft.fixedPrice ?? "", decimals)) {
      return "Fixed price must be a number greater than 0.";
    }
    return null;
  }

  const start = safeParseUnits(draft.startPrice ?? "", decimals);
  const reserve = safeParseUnits(draft.reservePrice ?? "", decimals);
  if (start === null || start <= 0n) return "Start price must be a number greater than 0.";
  if (reserve === null || reserve <= 0n) return "Reserve price must be a number greater than 0.";
  if (start <= reserve) return "Start price must be greater than the reserve price.";

  const hours = Number((draft.durationHrs ?? "").trim());
  if (!Number.isFinite(hours) || hours <= 0) return "Duration must be greater than 0 hours.";

  return null;
}

// ── Freelance form validation (AUDIT-REPORT.md § F1) ──────────────────

export interface MilestoneInputs {
  descriptions: string;
  amounts: string;
  durations: string;
}

export interface GigDraft {
  title: string;
  descriptionURI: string;
  price: string;
  minBudget?: string;
  milestones: MilestoneInputs;
}

export interface ProjectDraft {
  title: string;
  descriptionURI: string;
  totalBudget: string;
  durationDays?: string;
  milestones: MilestoneInputs;
}

/**
 * Validate comma-separated milestone inputs.
 *
 * Mirrors the on-chain checks in `FreelancerEscrow.createGig` /
 * `createProjectFixed`: at least 1 milestone, each amount > 0, each duration
 * a positive integer (days), and all three arrays the same length.
 *
 * @returns the first human-readable error, or `null` when valid.
 */
export function validateMilestones(m: MilestoneInputs): string | null {
  const descs = m.descriptions.split(",").map(s => s.trim()).filter(Boolean);
  const amts = m.amounts.split(",").map(s => s.trim()).filter(Boolean);
  const durs = m.durations.split(",").map(s => s.trim()).filter(Boolean);

  if (descs.length === 0) return "At least one milestone description is required.";
  if (amts.length === 0) return "At least one milestone amount is required.";
  if (durs.length === 0) return "At least one milestone duration is required.";

  if (descs.length !== amts.length || descs.length !== durs.length) {
    return `Mismatched milestone counts: ${descs.length} descriptions, ${amts.length} amounts, ${durs.length} durations.`;
  }

  for (let i = 0; i < amts.length; i++) {
    if (!isPositiveAmount(amts[i])) {
      return `Milestone ${i + 1} amount must be greater than 0.`;
    }
  }

  for (let i = 0; i < durs.length; i++) {
    const days = Number(durs[i]);
    if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
      return `Milestone ${i + 1} duration must be a positive whole number of days.`;
    }
  }

  return null;
}

/** Validate a gig creation draft. */
export function validateGigDraft(draft: GigDraft): string | null {
  if (!draft.title?.trim()) return "Title is required.";
  if (!draft.descriptionURI?.trim()) return "Description URI is required.";
  if (!isPositiveAmount(draft.price)) return "Price must be greater than 0.";
  return validateMilestones(draft.milestones);
}

/** Validate a project creation draft. */
export function validateProjectDraft(draft: ProjectDraft): string | null {
  if (!draft.title?.trim()) return "Title is required.";
  if (!draft.descriptionURI?.trim()) return "Description URI is required.";
  if (!isPositiveAmount(draft.totalBudget)) return "Total budget must be greater than 0.";
  return validateMilestones(draft.milestones);
}

/** True when `value` is a well-formed EVM address (checksum-aware, via viem). */
export function isValidAddress(value: string): boolean {
  return isAddress((value ?? "").trim());
}

/**
 * Validate and normalize a user-entered address.
 *
 * Accepts full addresses plus the bare zero-address shorthands (`0x0`, `0`)
 * that the RWA admin UI documents as the "disable" sentinel, which are NOT
 * valid `isAddress()` inputs; those normalize to `address(0)`.
 *
 * @returns the normalized address, or `null` when the input is unusable.
 */
export function normalizeAddressInput(value: string): Address | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (ZERO_ADDRESS_SENTINELS.includes(trimmed.toLowerCase())) return ZERO_ADDRESS;
  return isAddress(trimmed) ? (trimmed as Address) : null;
}
