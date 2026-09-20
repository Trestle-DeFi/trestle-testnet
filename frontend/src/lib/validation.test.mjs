// Regression tests for the frontend audit findings (AUDIT-REPORT.md § Frontend Audit):
//   - Marketplace: "No client-side validation on listing metadata before on-chain submission"
//   - RWA: "No address format validation on whitelist input fields"
//
// Run with: npm test  (Node's built-in test runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZERO_ADDRESS,
  isPositiveAmount,
  isValidAddress,
  normalizeAddressInput,
  safeParseUnits,
  validateGigDraft,
  validateListingDraft,
  validateMilestones,
  validateProjectDraft,
} from "./validation.ts";

const VALID_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678";

test("safeParseUnits accepts plain decimals", () => {
  assert.equal(safeParseUnits("0.00001"), 10000000000000n);
  assert.equal(safeParseUnits("1"), 1000000000000000000n);
  assert.equal(safeParseUnits(" 1.5 "), 1500000000000000000n);
  assert.equal(safeParseUnits("1000", 6), 1000000000n);
});

test("safeParseUnits rejects malformed / negative input instead of throwing", () => {
  for (const bad of ["", "   ", ".", "abc", "1.2.3", "-1", "1e5", "0x10"]) {
    assert.equal(safeParseUnits(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
  // More decimals than the token supports must not throw either.
  assert.equal(safeParseUnits("0.1234567", 6), null);
});

test("isPositiveAmount only accepts values above zero", () => {
  assert.equal(isPositiveAmount("0.00001"), true);
  assert.equal(isPositiveAmount("0"), false);
  assert.equal(isPositiveAmount(""), false);
  assert.equal(isPositiveAmount("-5"), false);
});

test("validateListingDraft requires a metadata URI", () => {
  const error = validateListingDraft({ metadataURI: "   ", pricingMode: "fixed", fixedPrice: "1" });
  assert.equal(error, "Metadata URI is required.");
});

test("validateListingDraft enforces the listFixed price > 0 guard", () => {
  const base = { metadataURI: "ipfs://QmHash", pricingMode: "fixed" };
  assert.equal(validateListingDraft({ ...base, fixedPrice: "" }), "Fixed price must be a number greater than 0.");
  assert.equal(validateListingDraft({ ...base, fixedPrice: "0" }), "Fixed price must be a number greater than 0.");
  assert.equal(validateListingDraft({ ...base, fixedPrice: "abc" }), "Fixed price must be a number greater than 0.");
  assert.equal(validateListingDraft({ ...base, fixedPrice: "0.00001" }), null);
});

test("validateListingDraft enforces DutchAuctionLib.validate (start > reserve, duration != 0)", () => {
  const base = {
    metadataURI: "ipfs://QmHash",
    pricingMode: "dutch",
    startPrice: "0.00005",
    reservePrice: "0.00001",
    durationHrs: "24",
  };
  assert.equal(validateListingDraft(base), null);
  assert.equal(
    validateListingDraft({ ...base, startPrice: "0.00001", reservePrice: "0.00001" }),
    "Start price must be greater than the reserve price.",
  );
  assert.equal(
    validateListingDraft({ ...base, startPrice: "0.000001" }),
    "Start price must be greater than the reserve price.",
  );
  assert.equal(validateListingDraft({ ...base, reservePrice: "0" }), "Reserve price must be a number greater than 0.");
  assert.equal(validateListingDraft({ ...base, startPrice: "" }), "Start price must be a number greater than 0.");
  assert.equal(validateListingDraft({ ...base, durationHrs: "0" }), "Duration must be greater than 0 hours.");
  assert.equal(validateListingDraft({ ...base, durationHrs: "" }), "Duration must be greater than 0 hours.");
  assert.equal(validateListingDraft({ ...base, durationHrs: "abc" }), "Duration must be greater than 0 hours.");
});

test("isValidAddress rejects malformed whitelist input", () => {
  assert.equal(isValidAddress(VALID_ADDRESS), true);
  assert.equal(isValidAddress(ZERO_ADDRESS), true);
  assert.equal(isValidAddress("0x0"), false);
  assert.equal(isValidAddress("0x1234...5678"), false);
  assert.equal(isValidAddress("not-an-address"), false);
  assert.equal(isValidAddress(""), false);
});

test("normalizeAddressInput normalizes the documented zero-address sentinel", () => {
  assert.equal(normalizeAddressInput("0x0"), ZERO_ADDRESS);
  assert.equal(normalizeAddressInput("0"), ZERO_ADDRESS);
  assert.equal(normalizeAddressInput("0x000"), ZERO_ADDRESS);
  assert.equal(normalizeAddressInput(VALID_ADDRESS), VALID_ADDRESS);
  assert.equal(normalizeAddressInput("  " + VALID_ADDRESS + "  "), VALID_ADDRESS);
  assert.equal(normalizeAddressInput("0x1234...5678"), null);
  assert.equal(normalizeAddressInput(""), null);
});

// ── Freelance validation (F1) ─────────────────────────────────────────

test("validateMilestones requires at least one milestone", () => {
  assert.equal(validateMilestones({ descriptions: "", amounts: "", durations: "" }), "At least one milestone description is required.");
  assert.equal(validateMilestones({ descriptions: "Design", amounts: "", durations: "" }), "At least one milestone amount is required.");
  assert.equal(validateMilestones({ descriptions: "Design", amounts: "0.001", durations: "" }), "At least one milestone duration is required.");
});

test("validateMilestones rejects mismatched counts", () => {
  const err = validateMilestones({ descriptions: "A,B,C", amounts: "0.001,0.002", durations: "7" });
  assert.match(err, /Mismatched milestone counts/);
});

test("validateMilestones rejects zero amounts", () => {
  const err = validateMilestones({ descriptions: "A", amounts: "0", durations: "7" });
  assert.match(err, /amount must be greater than 0/);
});

test("validateMilestones rejects non-integer durations", () => {
  assert.match(validateMilestones({ descriptions: "A", amounts: "1", durations: "3.5" }), /positive whole number/);
  assert.match(validateMilestones({ descriptions: "A", amounts: "1", durations: "0" }), /positive whole number/);
  assert.match(validateMilestones({ descriptions: "A", amounts: "1", durations: "-1" }), /positive whole number/);
});

test("validateMilestones accepts valid input", () => {
  assert.equal(validateMilestones({ descriptions: "Design,Develop", amounts: "0.001,0.002", durations: "7,14" }), null);
});

test("validateGigDraft requires title, description, price, and valid milestones", () => {
  const base = { title: "Web Dev", descriptionURI: "ipfs://QmDesc", price: "0.001", milestones: { descriptions: "A", amounts: "0.001", durations: "7" } };
  assert.equal(validateGigDraft(base), null);
  assert.equal(validateGigDraft({ ...base, title: "" }), "Title is required.");
  assert.equal(validateGigDraft({ ...base, descriptionURI: "" }), "Description URI is required.");
  assert.equal(validateGigDraft({ ...base, price: "0" }), "Price must be greater than 0.");
  assert.equal(validateGigDraft({ ...base, milestones: { descriptions: "", amounts: "", durations: "" } }), "At least one milestone description is required.");
});

test("validateProjectDraft requires title, description, budget, and valid milestones", () => {
  const base = { title: "Build DApp", descriptionURI: "ipfs://QmSpec", totalBudget: "0.01", milestones: { descriptions: "A", amounts: "0.005", durations: "14" } };
  assert.equal(validateProjectDraft(base), null);
  assert.equal(validateProjectDraft({ ...base, title: "" }), "Title is required.");
  assert.equal(validateProjectDraft({ ...base, descriptionURI: "" }), "Description URI is required.");
  assert.equal(validateProjectDraft({ ...base, totalBudget: "0" }), "Total budget must be greater than 0.");
});
