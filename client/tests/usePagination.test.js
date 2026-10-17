import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePagination,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from "../src/hooks/usePagination.js";

describe("computePagination", () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }));

  it("defaults to page size 10 and returns first page items", () => {
    const result = computePagination(items, 1, DEFAULT_PAGE_SIZE);
    assert.equal(result.pageSize, 10);
    assert.equal(result.totalItems, 23);
    assert.equal(result.totalPages, 3);
    assert.equal(result.page, 1);
    assert.equal(result.pageItems.length, 10);
    assert.equal(result.pageItems[0].id, 1);
    assert.equal(result.showPagination, true);
    assert.deepEqual(PAGE_SIZE_OPTIONS, [5, 10, 25]);
  });

  it("moves to next page and clamps past last page", () => {
    const page2 = computePagination(items, 2, 10);
    assert.equal(page2.page, 2);
    assert.equal(page2.pageItems[0].id, 11);
    assert.equal(page2.pageItems.length, 10);

    const page3 = computePagination(items, 3, 10);
    assert.equal(page3.page, 3);
    assert.equal(page3.pageItems.length, 3);
    assert.equal(page3.pageItems[0].id, 21);

    const pastEnd = computePagination(items, 99, 10);
    assert.equal(pastEnd.page, 3);
    assert.equal(pastEnd.pageItems.length, 3);
  });

  it("clamps to page 1 when page is invalid or below 1", () => {
    assert.equal(computePagination(items, 0, 10).page, 1);
    assert.equal(computePagination(items, -2, 10).page, 1);
    assert.equal(computePagination(items, NaN, 10).page, 1);
  });

  it("keeps page valid when the list shrinks (rows disappear)", () => {
    const short = items.slice(0, 5);
    const result = computePagination(short, 3, 10);
    assert.equal(result.totalPages, 1);
    assert.equal(result.page, 1);
    assert.equal(result.pageItems.length, 5);
    assert.equal(result.showPagination, false);
  });

  it("hides pagination for empty lists and single-page lists", () => {
    const empty = computePagination([], 1, 10);
    assert.equal(empty.totalItems, 0);
    assert.equal(empty.totalPages, 1);
    assert.equal(empty.pageItems.length, 0);
    assert.equal(empty.showPagination, false);

    const onePage = computePagination(items.slice(0, 8), 1, 10);
    assert.equal(onePage.totalPages, 1);
    assert.equal(onePage.showPagination, false);
  });

  it("supports page sizes 5 / 10 / 25", () => {
    assert.equal(computePagination(items, 1, 5).totalPages, 5);
    assert.equal(computePagination(items, 1, 5).pageItems.length, 5);
    assert.equal(computePagination(items, 1, 25).totalPages, 1);
    assert.equal(computePagination(items, 1, 25).pageItems.length, 23);
    assert.equal(computePagination(items, 1, 25).showPagination, false);
  });

  it("treats nullish items as empty", () => {
    const result = computePagination(null, 2, 10);
    assert.equal(result.totalItems, 0);
    assert.equal(result.page, 1);
    assert.equal(result.showPagination, false);
  });
});

describe("page reset semantics", () => {
  it("page 1 after refresh is the first slice of the current list", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `a${i}` }));
    const before = computePagination(items, 2, 5);
    assert.equal(before.page, 2);
    assert.equal(before.pageItems[0].id, "a5");

    // resetPage() in the hook sets page state to 1; verify that slice.
    const afterRefresh = computePagination(items, 1, 5);
    assert.equal(afterRefresh.page, 1);
    assert.equal(afterRefresh.pageItems[0].id, "a0");
  });
});
