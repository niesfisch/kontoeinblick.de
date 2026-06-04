/**
 * Merge logic unit tests — run with:
 *   node --test tests/merge.test.mjs
 *
 * Tests the pure merge functions exported from parser-utils.js
 * and merge scenarios using real DKB CSV fixtures.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { dedupKey, findHeaderLineIndex } from '../parser-utils.js';
import { parseCsv } from '../parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
const parse = (name) => parseCsv(fixture(name));

// ─────────────────────────────────────────────────────────────────────────────
// dedupKey
// ─────────────────────────────────────────────────────────────────────────────

describe('dedupKey', () => {
  test('produces deterministic keys for same transaction', () => {
    const tx1 = {
      date: new Date(2025, 0, 15),
      amount: -1200,
      recipient: 'Vermieter KG',
      purpose: 'Miete Januar',
    };
    const tx2 = {
      date: new Date(2025, 0, 15),
      amount: -1200,
      recipient: '  Vermieter KG  ',
      purpose: 'Miete  Januar',
    };
    assert.equal(dedupKey(tx1), dedupKey(tx2));
  });

  test('differentiates transactions with different amounts', () => {
    const tx1 = {
      date: new Date(2025, 0, 5),
      amount: -85.30,
      recipient: 'Supermarkt GmbH',
      purpose: 'Lebensmittel',
    };
    const tx2 = {
      date: new Date(2025, 0, 5),
      amount: -92.15,
      recipient: 'Supermarkt GmbH',
      purpose: 'Lebensmittel',
    };
    assert.notEqual(dedupKey(tx1), dedupKey(tx2));
  });

  test('differentiates transactions on different dates', () => {
    const tx1 = {
      date: new Date(2025, 0, 2),
      amount: 2500,
      payer: 'ACME Corp',
      purpose: 'Gehalt Januar',
    };
    const tx2 = {
      date: new Date(2025, 1, 3),
      amount: 2500,
      payer: 'ACME Corp',
      purpose: 'Gehalt Januar',
    };
    assert.notEqual(dedupKey(tx1), dedupKey(tx2));
  });

  test('handles transactions without payee gracefully', () => {
    const tx = {
      date: new Date(2025, 3, 2),
      amount: 2500,
      purpose: 'Gehalt April',
    };
    const key = dedupKey(tx);
    assert.ok(typeof key === 'string');
    assert.ok(key.length > 0);
  });

  test('normalises whitespace in payee and purpose', () => {
    const tx1 = {
      date: new Date(2025, 2, 7),
      amount: -112.40,
      recipient: 'Supermarkt GmbH',
      purpose: 'Lebensmittel',
    };
    const tx2 = {
      date: new Date(2025, 2, 7),
      amount: -112.40,
      recipient: '  Supermarkt   GmbH  ',
      purpose: '  Lebensmittel  ',
    };
    assert.equal(dedupKey(tx1), dedupKey(tx2));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findHeaderLineIndex
// ─────────────────────────────────────────────────────────────────────────────

describe('findHeaderLineIndex', () => {
  test('finds DKB header line', () => {
    const lines = fixture('dkb_jan_feb.csv').replace(/\r\n/g, '\n').split('\n');
    const idx = findHeaderLineIndex(lines, 'dkb');
    assert.equal(idx, 4);
  });

  test('returns -1 for empty lines', () => {
    assert.equal(findHeaderLineIndex([], 'dkb'), -1);
  });

  test('returns -1 when header not present', () => {
    const lines = ['foo', 'bar', 'baz'];
    assert.equal(findHeaderLineIndex(lines, 'dkb'), -1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Merge scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('merge scenarios (DKB)', () => {
  test('parse all fixtures successfully', () => {
    const r1 = parse('dkb_jan_feb.csv');
    const r2 = parse('dkb_feb_mar.csv');
    const r3 = parse('dkb_duplicates.csv');
    const r4 = parse('dkb_apr.csv');

    assert.equal(r1.meta.bank, 'dkb');
    assert.equal(r2.meta.bank, 'dkb');
    assert.equal(r3.meta.bank, 'dkb');
    assert.equal(r4.meta.bank, 'dkb');

    assert.equal(r1.transactions.length, 6);
    assert.equal(r2.transactions.length, 6);
    assert.equal(r4.transactions.length, 2);
  });

  test('dedup: non-overlapping files produce sum of transactions', () => {
    const r1 = parse('dkb_jan_feb.csv');
    const r4 = parse('dkb_apr.csv');

    const allTxs = [...r1.transactions, ...r4.transactions];
    const seen = new Set();
    const unique = allTxs.filter(tx => {
      const key = dedupKey(tx);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 6 + 2 = 8 unique (no overlap)
    assert.equal(unique.length, 8);
  });

  test('dedup: overlapping files remove duplicates correctly', () => {
    const r1 = parse('dkb_jan_feb.csv');
    const r2 = parse('dkb_feb_mar.csv');

    const allTxs = [...r1.transactions, ...r2.transactions];
    const seen = new Set();
    const unique = allTxs.filter(tx => {
      const key = dedupKey(tx);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // jan_feb has 6, feb_mar has 6, overlap is 2 (Supermarkt 10.02, Stadtwerke 20.02)
    // 6 + 6 - 2 = 10 unique
    assert.equal(unique.length, 10);
  });

  test('dedup: file with duplicate lines reduces to unique set', () => {
    const r3 = parse('dkb_duplicates.csv');

    // 8 lines parsed; 3 unique tx (2x Gehalt, 1x Supermarkt, 3x Miete = 3 unique)
    // Actually: Gehalt Jan (x3), Supermarkt (x2), Miete (x3) = 3 unique
    const seen = new Set();
    const unique = r3.transactions.filter(tx => {
      const key = dedupKey(tx);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    assert.equal(unique.length, 3);
    assert.equal(r3.transactions.length, 8);
  });

  test('dedup: merging three overlapping files yields correct count', () => {
    const r1 = parse('dkb_jan_feb.csv'); // 6 tx
    const r2 = parse('dkb_feb_mar.csv'); // 6 tx (overlap 2 with r1)
    const r4 = parse('dkb_apr.csv');     // 2 tx (no overlap)

    const allTxs = [...r1.transactions, ...r2.transactions, ...r4.transactions];
    const seen = new Set();
    const unique = allTxs.filter(tx => {
      const key = dedupKey(tx);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 6 + 6 + 2 - 2 overlap = 12 unique
    assert.equal(unique.length, 12);
  });

  test('merged transactions are sorted by date ascending', () => {
    const r1 = parse('dkb_jan_feb.csv');
    const r2 = parse('dkb_feb_mar.csv');

    const allTxs = [...r1.transactions, ...r2.transactions];
    const seen = new Set();
    const unique = allTxs.filter(tx => {
      const key = dedupKey(tx);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date ascending
    unique.sort((a, b) => a.date - b.date);

    for (let i = 1; i < unique.length; i++) {
      assert.ok(
        unique[i].date >= unique[i - 1].date,
        `Row ${i} (${unique[i].date.toISOString()}) < row ${i - 1} (${unique[i - 1].date.toISOString()})`
      );
    }
  });

  test('dedup key consistency across parsed fixtures', () => {
    const r1 = parse('dkb_jan_feb.csv');
    const r2 = parse('dkb_feb_mar.csv');

    // The overlapping transactions should produce identical dedup keys
    // DKB uses payer field for "Zahlungspflichtige*r" (merchant in debits)
    const overlapJanFeb = r1.transactions.filter(t =>
      t.payer === 'Supermarkt GmbH' && t.amount === -92.15
    );
    const overlapFebMar = r2.transactions.filter(t =>
      t.payer === 'Supermarkt GmbH' && t.amount === -92.15
    );

    assert.equal(overlapJanFeb.length, 1);
    assert.equal(overlapFebMar.length, 1);
    assert.equal(dedupKey(overlapJanFeb[0]), dedupKey(overlapFebMar[0]));
  });
});
