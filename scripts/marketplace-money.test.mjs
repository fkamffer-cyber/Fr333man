import assert from "node:assert/strict";
import test from "node:test";
import { parseMajorCurrencyToMinor } from "../src/lib/money.ts";

test("converts South African price input to cents", () => {
  assert.equal(parseMajorCurrencyToMinor("R 100.00"), 10_000);
  assert.equal(parseMajorCurrencyToMinor("1 234,56"), 123_456);
  assert.equal(parseMajorCurrencyToMinor("1,234.56"), 123_456);
  assert.equal(parseMajorCurrencyToMinor(85), 8_500);
});

test("rejects missing and negative prices", () => {
  assert.equal(Number.isNaN(parseMajorCurrencyToMinor("")), true);
  assert.equal(Number.isNaN(parseMajorCurrencyToMinor("-1")), true);
  assert.equal(Number.isNaN(parseMajorCurrencyToMinor(undefined)), true);
});
