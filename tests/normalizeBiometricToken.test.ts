import { strict as assert } from "node:assert";
import test from "node:test";

import {
  normalizeBiometricToken,
  normalizeBiometricTokenOrNull,
} from "@/utils/normalizeBiometricToken";

test("normalizeBiometricToken trims and pads numeric strings", () => {
  assert.equal(normalizeBiometricToken(" 123 "), "000123");
  assert.equal(normalizeBiometricToken("001234"), "001234");
});

test("normalizeBiometricToken uppercases alphanumeric tokens", () => {
  assert.equal(normalizeBiometricToken("abc123"), "ABC123");
  assert.equal(normalizeBiometricToken(" token-xy "), "TOKEN-XY");
});

test("normalizeBiometricToken handles blank inputs", () => {
  assert.equal(normalizeBiometricToken(null), "");
  assert.equal(normalizeBiometricToken("   "), "");
});

test("normalizeBiometricTokenOrNull returns null for blank inputs", () => {
  assert.equal(normalizeBiometricTokenOrNull("  "), null);
  assert.equal(normalizeBiometricTokenOrNull("123"), "000123");
});

