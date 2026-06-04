/**
 * Multi-bank CSV parser — entry point.
 *
 * Usage:
 *   import { parseCsv } from './parser.js';
 *   const { meta, transactions } = parseCsv(text);
 *
 * To add support for a new bank:
 *   1. Create parser-<bank>.js exporting { detect(lines), parse(lines), BANK_ID, BANK_NAME }
 *   2. Import it here and add it to PARSERS.
 *
 * meta always includes:
 *   bank, bankName, iban, period, accountType
 *   balanceRaw, balance, balanceDate  (where available in the source format)
 *
 * Each transaction has:
 *   bookingDate, valueDate, date, payer, recipient, purpose,
 *   type, iban, amount, status, creditorId, mandateRef, customerRef,
 *   isIncome, isExpense, year, month, monthKey
 */

import { cleanLines }  from './parser-utils.js';
import * as dkb        from './parser-dkb.js';
import * as ing        from './parser-ing.js';
import * as sparkasse  from './parser-sparkasse.js';

// Registry — detection runs top-to-bottom, first match wins.
const PARSERS = [dkb, ing, sparkasse];

/**
 * Auto-detect bank format and parse CSV text.
 * @param {string} text  Raw CSV file content (any encoding already decoded to a JS string)
 * @returns {{ meta: object, transactions: object[] }}
 */
export function parseCsv(text) {
  const lines = cleanLines(text);

  for (const parser of PARSERS) {
    if (parser.detect(lines)) {
      return parser.parse(lines);
    }
  }

  const supported = PARSERS.map(p => p.BANK_NAME).join(', ');
  throw new Error(`Unbekanntes CSV-Format. Unterstützte Banken: ${supported}.`);
}
