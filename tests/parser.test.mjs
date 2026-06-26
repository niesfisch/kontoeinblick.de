/**
 * Parser unit tests — run with:
 *   node --test tests/parser.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// ─── Import parsers directly (bypasses the auto-detect entry point) ────────────
import * as dkb from '../parser-dkb.js';
import * as ing from '../parser-ing.js';
import * as sparkasse from '../parser-sparkasse.js';
import { parseCsv } from '../parser.js';
import { parseGermanNumber, parseGermanDate, splitCSVLine, cleanLines } from '../parser-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

describe('parseGermanNumber', () => {
  test('parses positive amount', () => {
    assert.equal(parseGermanNumber('2.850,00'), 2850);
  });

  test('parses negative amount', () => {
    assert.equal(parseGermanNumber('-67,43'), -67.43);
  });

  test('parses amount without thousand separator', () => {
    assert.equal(parseGermanNumber('9,99'), 9.99);
  });

  test('parses large amount with multiple thousand separators', () => {
    assert.equal(parseGermanNumber('14.218,45'), 14218.45);
  });

  test('returns 0 for empty string', () => {
    assert.equal(parseGermanNumber(''), 0);
  });

  test('returns 0 for null/undefined', () => {
    assert.equal(parseGermanNumber(null), 0);
    assert.equal(parseGermanNumber(undefined), 0);
  });
});

describe('parseGermanDate', () => {
  test('parses DD.MM.YYYY', () => {
    const d = parseGermanDate('02.01.2025');
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 0); // January = 0
    assert.equal(d.getDate(), 2);
  });

  test('parses DD.MM.YY (two-digit year)', () => {
    const d = parseGermanDate('15.06.25');
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 5);
    assert.equal(d.getDate(), 15);
  });

  test('returns null for empty string', () => {
    assert.equal(parseGermanDate(''), null);
  });

  test('returns null for invalid format', () => {
    assert.equal(parseGermanDate('2025-01-02'), null);
  });
});

describe('splitCSVLine', () => {
  test('splits basic semicolon-separated line', () => {
    assert.deepEqual(splitCSVLine('a;b;c'), ['a', 'b', 'c']);
  });

  test('handles quoted fields containing semicolons', () => {
    assert.deepEqual(splitCSVLine('"a;b";c;"d;e"'), ['a;b', 'c', 'd;e']);
  });

  test('strips surrounding quotes', () => {
    assert.deepEqual(splitCSVLine('"hello";"world"'), ['hello', 'world']);
  });

  test('handles empty fields', () => {
    assert.deepEqual(splitCSVLine('a;;c'), ['a', '', 'c']);
  });

  test('handles quoted empty fields', () => {
    assert.deepEqual(splitCSVLine('"a";"";"c"'), ['a', '', 'c']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DKB parser
// ─────────────────────────────────────────────────────────────────────────────

describe('DKB detect()', () => {
  test('detects DKB format', () => {
    const lines = cleanLines(fixture('dkb_standard.csv'));
    assert.equal(dkb.detect(lines), true);
  });

  test('does not detect ING as DKB', () => {
    const lines = cleanLines(fixture('ing_with_saldo.csv'));
    assert.equal(dkb.detect(lines), false);
  });
});

describe('DKB parse() — standard fixture', () => {
  let result;
  test('parses without error', () => {
    const lines = cleanLines(fixture('dkb_standard.csv'));
    result = dkb.parse(lines);
  });

  test('sets bank metadata', () => {
    assert.equal(result.meta.bank, 'dkb');
    assert.equal(result.meta.bankName, 'Deutsche Kreditbank (DKB)');
  });

  test('extracts IBAN', () => {
    assert.equal(result.meta.iban, 'DE12 3456 7890 1234 5678 90');
  });

  test('extracts period', () => {
    assert.equal(result.meta.period, '01.01.2025 - 31.03.2025');
  });

  test('extracts balance', () => {
    assert.equal(result.meta.balance, 2847.63);
    assert.equal(result.meta.balanceDate, '31.03.2025');
  });

  test('parses correct number of transactions', () => {
    assert.equal(result.transactions.length, 5);
  });

  test('sorts transactions ascending by date', () => {
    const dates = result.transactions.map(tx => tx.date.getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
  });

  test('parses expense transaction fields', () => {
    const tx = result.transactions.find(tx => tx.recipient === 'REWE Markt GmbH');
    assert.ok(tx, 'REWE transaction not found');
    assert.equal(tx.amount, -67.43);
    assert.equal(tx.isExpense, true);
    assert.equal(tx.isIncome, false);
    assert.equal(tx.bookingDate, '02.01.2025');
    assert.equal(tx.valueDate, '02.01.2025');
    assert.equal(tx.purpose, 'Einkauf Lebensmittel');
    assert.equal(tx.type, 'Lastschrift');
    assert.equal(tx.iban, 'DE98765432109876543210');
    assert.equal(tx.customerRef, '2025010201');
  });

  test('parses income transaction fields', () => {
    const tx = result.transactions.find(tx => tx.payer === 'Mustermann GmbH');
    assert.ok(tx, 'income transaction not found');
    assert.equal(tx.amount, 2850);
    assert.equal(tx.isIncome, true);
    assert.equal(tx.isExpense, false);
    assert.equal(tx.purpose, 'Gehalt Januar 2025');
    assert.equal(tx.type, 'Gutschrift');
  });

  test('computes monthKey correctly', () => {
    const tx = result.transactions.find(tx => tx.bookingDate === '01.02.2025');
    assert.ok(tx);
    assert.equal(tx.monthKey, '2025-02');
    assert.equal(tx.year, 2025);
    assert.equal(tx.month, 1); // February = 1
  });

  test('populates creditorId and mandateRef for direct debit', () => {
    const tx = result.transactions.find(tx => tx.recipient === 'Spotify AB');
    assert.ok(tx);
    assert.equal(tx.creditorId, 'SE59ZZZ09368111746');
    assert.equal(tx.mandateRef, 'SPOTIFY-001');
  });
});

describe('DKB parse() — no balance line', () => {
  test('parses without error when balance line is missing', () => {
    const lines = cleanLines(fixture('dkb_no_balance.csv'));
    const result = dkb.parse(lines);
    assert.equal(result.transactions.length, 1);
    assert.equal(result.meta.balance, undefined);
    assert.equal(result.meta.balanceDate, undefined);
  });
});

describe('DKB parse() — quoted special characters', () => {
  test('handles quoted fields containing quotes (payee with quotes)', () => {
    const lines = cleanLines(fixture('dkb_special_chars.csv'));
    const result = dkb.parse(lines);
    assert.equal(result.transactions.length, 2);
  });

  test('parses income with semicolon in payer name via quoting', () => {
    const lines = cleanLines(fixture('dkb_special_chars.csv'));
    const result = dkb.parse(lines);
    const income = result.transactions.find(tx => tx.isIncome);
    assert.ok(income);
    assert.equal(income.amount, 1200);
  });
});

describe('DKB parse() — error handling', () => {
  test('throws when header row is missing', () => {
    // Must have ≥3 lines with valid semicolon structure so metadata parsing
    // doesn't crash before the header-search code path is reached.
    const lines = cleanLines('"Girokonto";"DE123"\n"Zeitraum:";"01.01.2025 - 31.01.2025"\n"Sonstiges";""\n"noch eine Zeile"\n');
    assert.throws(() => dkb.parse(lines), /Header-Zeile/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ING-DiBa parser
// ─────────────────────────────────────────────────────────────────────────────

describe('ING detect()', () => {
  test('detects ING format (with Saldo)', () => {
    const lines = cleanLines(fixture('ing_with_saldo.csv'));
    assert.equal(ing.detect(lines), true);
  });

  test('detects ING format (without Saldo)', () => {
    const lines = cleanLines(fixture('ing_without_saldo.csv'));
    assert.equal(ing.detect(lines), true);
  });

  test('does not detect DKB as ING', () => {
    const lines = cleanLines(fixture('dkb_standard.csv'));
    assert.equal(ing.detect(lines), false);
  });
});

describe('ING parse() — with Saldo column', () => {
  let result;
  test('parses without error', () => {
    const lines = cleanLines(fixture('ing_with_saldo.csv'));
    result = ing.parse(lines);
  });

  test('sets bank metadata', () => {
    assert.equal(result.meta.bank, 'ing');
    assert.equal(result.meta.bankName, 'ING-DiBa');
  });

  test('extracts IBAN', () => {
    assert.equal(result.meta.iban, 'DE12 3456 7890 1234 5678 90');
  });

  test('extracts period', () => {
    assert.equal(result.meta.period, '01.01.2025 - 31.03.2025');
  });

  test('extracts balance', () => {
    assert.equal(result.meta.balance, 1330.83);
    assert.equal(result.meta.balanceRaw, '1.330,83 EUR');
  });

  test('parses correct number of transactions', () => {
    assert.equal(result.transactions.length, 6);
  });

  test('sorts transactions ascending by date', () => {
    const dates = result.transactions.map(tx => tx.date.getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
  });

  test('maps expense payee to recipient', () => {
    const tx = result.transactions.find(tx => tx.isExpense);
    assert.ok(tx);
    assert.equal(tx.recipient, ''); // empty payee in fixture for Wertpapierkauf
    assert.equal(tx.payer, '');
  });

  test('maps income payee to payer', () => {
    const tx = result.transactions.find(tx => tx.isIncome);
    assert.ok(tx);
    assert.equal(tx.payer, 'MAX MUSTERMANN');
    assert.equal(tx.recipient, '');
  });

  test('parses amount and sets isIncome/isExpense', () => {
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.amount, -500);
    assert.equal(expense.isExpense, true);
    assert.equal(expense.isIncome, false);

    const income = result.transactions.find(tx => tx.isIncome);
    assert.equal(income.amount, 500);
    assert.equal(income.isIncome, true);
    assert.equal(income.isExpense, false);
  });

  test('parses valueDate', () => {
    const tx = result.transactions[0]; // earliest after sort
    assert.ok(tx.valueDate);
  });

  test('parses Buchungstext as type', () => {
    const tx = result.transactions.find(tx => tx.payer === 'MAX MUSTERMANN');
    assert.equal(tx.type, 'Lastschrifteinzug');
  });

  test('parses Verwendungszweck as purpose', () => {
    const tx = result.transactions.find(tx => tx.payer === 'MAX MUSTERMANN');
    assert.ok(tx.purpose.startsWith('Sparplan ISIN'));
  });

  test('computes monthKey correctly', () => {
    const jan = result.transactions.find(tx => tx.bookingDate === '02.01.2025');
    assert.ok(jan);
    assert.equal(jan.monthKey, '2025-01');
    assert.equal(jan.year, 2025);
    assert.equal(jan.month, 0);
  });
});

describe('ING parse() — without Saldo column', () => {
  let result;
  test('parses without error', () => {
    const lines = cleanLines(fixture('ing_without_saldo.csv'));
    result = ing.parse(lines);
  });

  test('parses same number of transactions as with-Saldo variant', () => {
    // 4 rows in fixture
    assert.equal(result.transactions.length, 4);
  });

  test('has no balance in meta', () => {
    assert.equal(result.meta.balance, undefined);
    assert.equal(result.meta.balanceRaw, undefined);
  });

  test('correctly identifies income and expense', () => {
    const incomes  = result.transactions.filter(tx => tx.isIncome);
    const expenses = result.transactions.filter(tx => tx.isExpense);
    assert.equal(incomes.length, 2);
    assert.equal(expenses.length, 2);
  });

  test('amounts match equivalent with-Saldo rows', () => {
    const amounts = result.transactions.map(tx => tx.amount).sort((a, b) => a - b);
    assert.deepEqual(amounts, [-500, -500, 500, 500]);
  });
});

describe('ING parse() — income vs expense payee mapping', () => {
  test('income payee goes to payer, expense payee is empty when no counterpart', () => {
    const lines = cleanLines(fixture('ing_income_expense.csv'));
    const result = ing.parse(lines);
    assert.equal(result.transactions.length, 2);

    const income = result.transactions.find(tx => tx.isIncome);
    assert.equal(income.payer, 'ARBEITGEBER GMBH');
    assert.equal(income.recipient, '');

    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.recipient, '');
    assert.equal(expense.payer, '');
  });
});

describe('ING parse() — error handling', () => {
  test('throws when header row is missing', () => {
    const lines = cleanLines('Umsatzanzeige;test\n\nIBAN;DE123\nBank;ING\n\nno data header here\n');
    assert.throws(() => ing.parse(lines), /Header-Zeile/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sparkasse
// ─────────────────────────────────────────────────────────────────────────────

describe('Sparkasse parse()', () => {
  let result;
  test('parses without error', () => {
    const lines = cleanLines(fixture('sparkasse_standard.csv'));
    result = sparkasse.parse(lines);
  });

  test('parses all transactions', () => {
    assert.equal(result.transactions.length, 2);
  });

  test('correctly identifies income and expense', () => {
    const income  = result.transactions.find(tx => tx.isIncome);
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.ok(income);
    assert.ok(expense);
    assert.equal(income.amount, 2850);
    assert.equal(expense.amount, -50.01);
  });

  test('maps payee to payer for income', () => {
    const income = result.transactions.find(tx => tx.isIncome);
    assert.equal(income.payer, 'ARBEITGEBER GMBH');
    assert.equal(income.recipient, '');
  });

  test('maps payee to recipient for expense', () => {
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.recipient, 'star Tankstelle//Voerde/DE');
    assert.equal(expense.payer, '');
  });

  test('parses Buchungstext as type', () => {
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.type, 'KARTENZAHLUNG');
  });

  test('parses valueDate', () => {
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.valueDate, '05.03.26');
  });

  test('computes monthKey correctly', () => {
    const expense = result.transactions.find(tx => tx.isExpense);
    assert.equal(expense.monthKey, '2026-03');
    assert.equal(expense.year, 2026);
    assert.equal(expense.month, 2);
  });

  test('includes IBAN in transaction', () => {
    const tx = result.transactions[0];
    assert.equal(tx.iban, 'DExxxxxxxxxxxxxxxxxxxx');
  });

  test('includes purpose', () => {
    const income = result.transactions.find(tx => tx.isIncome);
    assert.equal(income.purpose, 'Gehalt März 2026');
  });
});

describe('Sparkasse meta extraction', () => {
  test('meta.iban uses Auftragskonto (account owner), not the counterparty IBAN', () => {
    const csv = [
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
      '"DE00OWNER00000000000";"05.03.26";"05.03.26";"KARTENZAHLUNG";"Test";;;;;;;"star Tankstelle";"DE99COUNTERPARTY9999";"HELADEFFXXX";"-50,01";"EUR";"Umsatz gebucht"',
    ].join('\n');
    const result = sparkasse.parse(cleanLines(csv));
    assert.equal(result.meta.iban, 'DE00OWNER00000000000');
    // The transaction-level IBAN remains the counterparty's
    assert.equal(result.transactions[0].iban, 'DE99COUNTERPARTY9999');
  });

  test('meta.period is derived from the transaction date range', () => {
    const result = sparkasse.parse(cleanLines(fixture('sparkasse_standard.csv')));
    assert.equal(result.meta.period, '03.03.2026 - 05.03.2026');
  });
});

describe('Sparkasse detect()', () => {
  test('detects Sparkasse CSV by header', () => {
    const lines = cleanLines(fixture('sparkasse_standard.csv'));
    assert.equal(sparkasse.detect(lines), true);
  });

  test('rejects DKB CSV', () => {
    const lines = cleanLines(fixture('dkb_standard.csv'));
    assert.equal(sparkasse.detect(lines), false);
  });

  test('rejects ING CSV', () => {
    const lines = cleanLines(fixture('ing_with_saldo.csv'));
    assert.equal(sparkasse.detect(lines), false);
  });
});

describe('Sparkasse error handling', () => {
  test('throws when header row is missing', () => {
    const lines = cleanLines('irgendwas\nirgendwas\n');
    assert.throws(() => sparkasse.parse(lines), /Header-Zeile/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detection (parseCsv entry point)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCsv() auto-detection', () => {
  test('auto-detects DKB', () => {
    const result = parseCsv(fixture('dkb_standard.csv'));
    assert.equal(result.meta.bank, 'dkb');
  });

  test('auto-detects ING (with Saldo)', () => {
    const result = parseCsv(fixture('ing_with_saldo.csv'));
    assert.equal(result.meta.bank, 'ing');
  });

  test('auto-detects ING (without Saldo)', () => {
    const result = parseCsv(fixture('ing_without_saldo.csv'));
    assert.equal(result.meta.bank, 'ing');
  });

  test('auto-detects Sparkasse', () => {
    const result = parseCsv(fixture('sparkasse_standard.csv'));
    assert.equal(result.meta.bank, 'sparkasse');
  });

  test('throws for unknown format', () => {
    assert.throws(
      () => parseCsv('Date,Amount,Description\n2025-01-01,-10.00,Coffee\n'),
      /Unbekanntes CSV-Format/
    );
  });

  test('DKB result has same transactions as direct dkb.parse()', () => {
    const text  = fixture('dkb_standard.csv');
    const via   = parseCsv(text);
    const direct = dkb.parse(cleanLines(text));
    assert.equal(via.transactions.length, direct.transactions.length);
    assert.equal(via.meta.iban, direct.meta.iban);
  });

  test('ING result has same transactions as direct ing.parse()', () => {
    const text   = fixture('ing_with_saldo.csv');
    const via    = parseCsv(text);
    const direct = ing.parse(cleanLines(text));
    assert.equal(via.transactions.length, direct.transactions.length);
    assert.equal(via.meta.iban, direct.meta.iban);
  });

  test('Sparkasse result has same transactions as direct sparkasse.parse()', () => {
    const text   = fixture('sparkasse_standard.csv');
    const via    = parseCsv(text);
    const direct = sparkasse.parse(cleanLines(text));
    assert.equal(via.transactions.length, direct.transactions.length);
    assert.equal(via.meta.iban, direct.meta.iban);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transaction shape invariants — apply to both parsers
// ─────────────────────────────────────────────────────────────────────────────

describe('Transaction shape invariants', () => {
  const fixtures = [
    ['DKB standard',        () => parseCsv(fixture('dkb_standard.csv'))],
    ['ING with Saldo',      () => parseCsv(fixture('ing_with_saldo.csv'))],
    ['ING without Saldo',   () => parseCsv(fixture('ing_without_saldo.csv'))],
    ['Sparkasse standard',  () => parseCsv(fixture('sparkasse_standard.csv'))],
  ];

  for (const [label, load] of fixtures) {
    test(`${label}: every tx has required fields`, () => {
      const { transactions } = load();
      for (const tx of transactions) {
        assert.ok(tx.date instanceof Date,     `date is not a Date`);
        assert.ok(!isNaN(tx.date.getTime()),   `date is invalid`);
        assert.equal(typeof tx.amount,    'number');
        assert.equal(typeof tx.payer,     'string');
        assert.equal(typeof tx.recipient, 'string');
        assert.equal(typeof tx.purpose,   'string');
        assert.equal(typeof tx.monthKey,  'string');
        assert.match(tx.monthKey, /^\d{4}-\d{2}$/);
        assert.equal(tx.isIncome,  tx.amount > 0);
        assert.equal(tx.isExpense, tx.amount < 0);
        assert.equal(tx.year,  tx.date.getFullYear());
        assert.equal(tx.month, tx.date.getMonth());
      }
    });

    test(`${label}: isIncome and isExpense are mutually exclusive (zero not expected)`, () => {
      const { transactions } = load();
      for (const tx of transactions) {
        assert.ok(tx.isIncome !== tx.isExpense || tx.amount === 0);
      }
    });
  }
});
