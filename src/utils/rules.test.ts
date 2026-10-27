import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toMilli,
  fromMilli,
  formatQuantity,
  validatePasswordStrength,
  calculateAvailableQuantity,
  evaluateDelegationRule,
  getFiscalYear,
  formatTrxNumber,
  generateTemporaryPassword,
  generateItemCode,
  validateImportRowData,
} from './rules.ts';

test('milli conversions preserve precision up to 3 decimals', () => {
  assert.equal(toMilli(5.25), 5250);
  assert.equal(toMilli(0.001), 1);
  assert.equal(fromMilli(5250), 5.25);
  assert.equal(fromMilli(1), 0.001);
  assert.equal(formatQuantity(5250), '5.25');
  assert.equal(formatQuantity(10000), '10');
});

test('available quantity calculation respects reserved stock', () => {
  // Total 100 units (100,000 milli), Reserved 25 units (25,000 milli) -> 75 free
  assert.equal(calculateAvailableQuantity(100000, 25000), 75);
  // Reserved exceeds total (edge case) -> clamps to 0
  assert.equal(calculateAvailableQuantity(10000, 20000), 0);
});

test('password strength validation enforces all 5 enterprise criteria', () => {
  assert.equal(validatePasswordStrength('short').valid, false);
  assert.equal(validatePasswordStrength('alllowercase1!').valid, false); // no upper
  assert.equal(validatePasswordStrength('ALLUPPERCASE1!').valid, false); // no lower
  assert.equal(validatePasswordStrength('UpperLower!@#$').valid, false); // no digit
  assert.equal(validatePasswordStrength('UpperLower1234').valid, false); // no special
  assert.equal(validatePasswordStrength('Admin@2026').valid, true);
});

test('delegation evaluation checks operation limit, daily limit, and non-delegated items', () => {
  // 1. Non-delegated item
  const nonDelegated = evaluateDelegationRule({
    isDelegatedItem: false,
    requestedQtyMilli: 5000,
    maxQtyPerOpMilli: 10000,
    dailyLimitMilli: 50000,
    todayConsumedMilli: 0,
  });
  assert.equal(nonDelegated.isDelegated, false);
  assert.equal(nonDelegated.badge, 'amber');

  // 2. Delegated within limits
  const validDelegated = evaluateDelegationRule({
    isDelegatedItem: true,
    requestedQtyMilli: 5000,
    maxQtyPerOpMilli: 10000,
    dailyLimitMilli: 50000,
    todayConsumedMilli: 10000,
  });
  assert.equal(validDelegated.isDelegated, true);
  assert.equal(validDelegated.badge, 'green');
  assert.equal(validDelegated.remainingTodayMilli, 35000);

  // 3. Exceeds single operation limit
  const exceedsOp = evaluateDelegationRule({
    isDelegatedItem: true,
    requestedQtyMilli: 15000,
    maxQtyPerOpMilli: 10000,
    dailyLimitMilli: 50000,
    todayConsumedMilli: 0,
  });
  assert.equal(exceedsOp.isDelegated, false);
  assert.equal(exceedsOp.badge, 'amber');

  // 4. Exceeds daily remaining limit
  const exceedsDaily = evaluateDelegationRule({
    isDelegatedItem: true,
    requestedQtyMilli: 8000,
    maxQtyPerOpMilli: 10000,
    dailyLimitMilli: 20000,
    todayConsumedMilli: 15000,
  });
  assert.equal(exceedsDaily.isDelegated, false);
  assert.equal(exceedsDaily.badge, 'amber');
});

test('fiscal year calculates July 1 rollover and TRX format correctly', () => {
  // Date in August 2026 -> FY 2026
  const dateAug = new Date(2026, 7, 15);
  assert.equal(getFiscalYear(dateAug), 2026);
  assert.equal(formatTrxNumber(42, dateAug), 'TRX-2026-000042');

  // Date in March 2026 -> FY 2025
  const dateMarch = new Date(2026, 2, 10);
  assert.equal(getFiscalYear(dateMarch), 2025);
  assert.equal(formatTrxNumber(1, dateMarch), 'TRX-2025-000001');
});

test('temporary password generator produces valid strong password', () => {
  const pwd = generateTemporaryPassword();
  assert.ok(pwd.length >= 8);
  const result = validatePasswordStrength(pwd);
  assert.equal(result.valid, true);
});

test('item code generation formats prefix and 4-digit sequence [PREFIX]-0001', () => {
  assert.equal(generateItemCode('WOD', 1), 'WOD-0001');
  assert.equal(generateItemCode('elec', 25), 'ELEC-0025');
  assert.equal(generateItemCode('TOOL', 142), 'TOOL-0142');
});

test('foundational import row validation enforces all-or-nothing field completeness', () => {
  // Valid row
  const valid = validateImportRowData({
    itemName: 'خشب زان',
    categoryName: 'أخشاب',
    unitName: 'متر',
    initialQty: 10.5,
  });
  assert.equal(valid.valid, true);

  // Missing name
  const missingName = validateImportRowData({
    itemName: '',
    categoryName: 'أخشاب',
    unitName: 'متر',
    initialQty: 10,
  });
  assert.equal(missingName.valid, false);

  // Negative quantity
  const negativeQty = validateImportRowData({
    itemName: 'مسمار',
    categoryName: 'تثبيت',
    unitName: 'علبة',
    initialQty: -5,
  });
  assert.equal(negativeQty.valid, false);
});
