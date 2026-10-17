import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAge,
  formatPediatricAge,
  formatBirthdateLong,
  getBirthdateError,
  presentChildForRole,
  MAX_PEDIATRIC_AGE_YEARS,
} from "../src/utils/pediatricAge.js";

describe("pediatricAge", () => {
  it("handles a birthday not yet reached this year", () => {
    const age = calculateAge("2019-12-25", "2026-03-01");
    assert.deepEqual(age, { years: 6, months: 2, days: 4 });
  });

  it("handles Feb 29 birthdates on non-leap years", () => {
    const age = calculateAge("2020-02-29", "2025-02-28");
    assert.equal(age.years, 4);
    assert.equal(age.months, 11);
  });

  it("formats a baby under 1 month in days", () => {
    assert.equal(formatPediatricAge("2026-03-01", "2026-03-10"), "9 days");
    assert.equal(formatPediatricAge("2026-03-09", "2026-03-10"), "1 day");
  });

  it("formats a child under 2 years in months", () => {
    assert.equal(formatPediatricAge("2025-07-10", "2026-03-10"), "8 months");
  });

  it("formats older children as years and months", () => {
    assert.equal(formatPediatricAge("2022-11-10", "2026-03-10"), "3 years, 4 months");
    assert.equal(formatPediatricAge("2020-03-10", "2026-03-10"), "6 years");
  });

  it("rejects future birthdates", () => {
    assert.match(getBirthdateError("2099-01-01", "2026-03-10"), /future/i);
  });

  it(`rejects ages over ${MAX_PEDIATRIC_AGE_YEARS}`, () => {
    assert.match(getBirthdateError("2000-01-01", "2026-03-10"), /18/);
  });

  it("formats long birthdates for parents", () => {
    assert.equal(formatBirthdateLong("2019-03-05"), "March 5, 2019");
  });

  it("presentChildForRole returns birthdate only for parents", () => {
    const presented = presentChildForRole(
      { childName: "Ana", birthdate: "2019-03-05", sex: "Female", age: "7" },
      "parent",
      "2026-03-10"
    );
    assert.equal(presented.birthdateDisplay, "March 5, 2019");
    assert.equal(presented.ageDisplay, undefined);
  });

  it("presentChildForRole returns computed age only for staff", () => {
    const presented = presentChildForRole(
      { childName: "Ana", birthdate: "2019-03-05", sex: "Female" },
      "doctor",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "7 years");
    assert.equal(presented.birthdate, undefined);
    assert.equal(presented.birthdateDisplay, undefined);
  });

  it("staff falls back to legacy age when birthdate is missing", () => {
    const presented = presentChildForRole(
      { childName: "Ana", age: "4", sex: "Female" },
      "secretary",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "4 years");
    assert.equal(presented.hasLegacyAgeOnly, true);
  });
});
