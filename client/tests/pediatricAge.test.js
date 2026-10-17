import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAge,
  calculateAgeInYears,
  formatPediatricAge,
  formatBirthdateLong,
  getBirthdateError,
  getEnteredAgeError,
  presentChildForRole,
  MAX_PEDIATRIC_AGE_YEARS,
} from "../src/utils/pediatricAge.js";

describe("pediatricAge", () => {
  it("returns whole years for birthdate Jan 1, 2020 as of a fixed today", () => {
    assert.equal(calculateAgeInYears("2020-01-01", "2026-03-10"), 6);
    assert.equal(formatPediatricAge("2020-01-01", "2026-03-10"), "6");
  });

  it("handles a birthday not yet reached this year", () => {
    const age = calculateAge("2019-12-25", "2026-03-01");
    assert.deepEqual(age, { years: 6, months: 2, days: 4 });
    assert.equal(calculateAgeInYears("2019-12-25", "2026-03-01"), 6);
    assert.equal(formatPediatricAge("2019-12-25", "2026-03-01"), "6");
  });

  it("returns the new age on the birthday", () => {
    assert.equal(calculateAgeInYears("2020-03-10", "2026-03-10"), 6);
    assert.equal(formatPediatricAge("2020-03-10", "2026-03-10"), "6");
  });

  it("handles Feb 29 birthdates on non-leap years", () => {
    const age = calculateAge("2020-02-29", "2025-02-28");
    assert.equal(age.years, 4);
    assert.equal(age.months, 11);
    assert.equal(calculateAgeInYears("2020-02-29", "2025-02-28"), 4);
    assert.equal(calculateAgeInYears("2020-02-29", "2025-03-01"), 5);
  });

  it("returns 0 under 1 year and 1 for about 21 months (not months text)", () => {
    assert.equal(calculateAgeInYears("2025-07-10", "2026-03-10"), 0);
    assert.equal(formatPediatricAge("2025-07-10", "2026-03-10"), "0");
    assert.equal(calculateAgeInYears("2024-06-10", "2026-03-10"), 1);
    assert.equal(formatPediatricAge("2024-06-10", "2026-03-10"), "1");
    assert.ok(!formatPediatricAge("2024-06-10", "2026-03-10").includes("month"));
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

  it("presentChildForRole returns whole-year age only for staff", () => {
    const presented = presentChildForRole(
      { childName: "Ana", birthdate: "2019-03-05", sex: "Female" },
      "doctor",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "7");
    assert.equal(presented.birthdate, undefined);
    assert.equal(presented.birthdateDisplay, undefined);
  });

  it("staff falls back to entered/legacy age when birthdate is missing", () => {
    const presented = presentChildForRole(
      { childName: "Ana", age: "4", sex: "Female" },
      "secretary",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "4");
    assert.equal(presented.hasLegacyAgeOnly, true);
  });

  it("walk-in with age 2 shows Age: 2 for the doctor", () => {
    const presented = presentChildForRole(
      { childName: "Walk In", age: "2", sex: "Male" },
      "doctor",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "2");
  });

  it("existing walk-in with saved birthdate still displays whole years", () => {
    const presented = presentChildForRole(
      { childName: "Legacy Walk In", birthdate: "2020-01-15", sex: "Female" },
      "doctor",
      "2026-03-10"
    );
    assert.equal(presented.ageDisplay, "6");
  });

  it("getEnteredAgeError validates empty, negative, non-numeric, and above max", () => {
    assert.match(getEnteredAgeError(""), /required/i);
    assert.match(getEnteredAgeError(null), /required/i);
    assert.match(getEnteredAgeError("-1"), /negative/i);
    assert.match(getEnteredAgeError("abc"), /whole number/i);
    assert.match(getEnteredAgeError("2.5"), /whole number/i);
    assert.match(getEnteredAgeError("19"), /18/);
    assert.equal(getEnteredAgeError("0"), "");
    assert.equal(getEnteredAgeError("2"), "");
    assert.equal(getEnteredAgeError("18"), "");
  });
});
