/**
 * Sparkasse CSV parser.
 *
 * Expected format (semicolon-separated, quoted fields):
 *   Line 0: header row with columns:
 *     Auftragskonto; Buchungstag; Valutadatum; Buchungstext; Verwendungszweck;
 *     Glaeubiger ID; Mandatsreferenz; Kundenreferenz (End-to-End);
 *     Sammlerreferenz; Lastschrift Ursprungsbetrag;
 *     Auslagenersatz Ruecklastschrift; Beguenstigter/Zahlungspflichtiger;
 *     Kontonummer/IBAN; BIC (SWIFT-Code); Betrag; Waehrung; Info
 *   Line 1+: data rows
 *
 * No separate metadata block — just a header and data rows.
 */

import { parseGermanNumber, parseGermanDate, splitCSVLine, makeTx, periodFromTransactions } from './parser-utils.js';

export const BANK_ID   = 'sparkasse';
export const BANK_NAME = 'Sparkasse';

/** Returns true when the raw line array looks like a Sparkasse export. */
export function detect(lines) {
  for (const line of lines.slice(0, 5)) {
    if (line.includes('Auftragskonto') && line.includes('Beguenstigter/Zahlungspflichtiger')) return true;
  }
  return false;
}

/** Parse pre-split lines and return { meta, transactions }. */
export function parse(lines) {
  const meta = { bank: BANK_ID, bankName: BANK_NAME };

  const COL_ACCOUNT  = 0;  // Auftragskonto (account owner IBAN)
  const COL_BOOKING  = 1;  // Buchungstag
  const COL_VALDATE  = 2;  // Valutadatum
  const COL_TYPE     = 3;  // Buchungstext
  const COL_PURPOSE  = 4;  // Verwendungszweck
  const COL_CREDITOR = 5;  // Glaeubiger ID
  const COL_MANDATE  = 6;  // Mandatsreferenz
  const COL_CUSTREF  = 7;  // Kundenreferenz (End-to-End)
  const COL_PAYEE    = 11; // Beguenstigter/Zahlungspflichtiger
  const COL_IBAN     = 12; // Kontonummer/IBAN (counterparty)
  const COL_AMOUNT   = 14; // Betrag

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Auftragskonto')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Sparkasse: Header-Zeile (Auftragskonto) nicht gefunden.');

  const transactions = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = splitCSVLine(line);
    if (f.length <= COL_AMOUNT) continue;

    // Extract account IBAN from first data row (Auftragskonto)
    if (meta.iban === undefined && f[COL_ACCOUNT]) {
      meta.iban = f[COL_ACCOUNT].trim();
    }

    const bookingDate = f[COL_BOOKING];
    const date = parseGermanDate(bookingDate);
    if (!date) continue;

    const amount  = parseGermanNumber(f[COL_AMOUNT]);
    const payee   = (f[COL_PAYEE]   || '').replace(/\s+/g, ' ').trim();
    const purpose = (f[COL_PURPOSE] || '').replace(/\s+/g, ' ').trim();
    const type    = (f[COL_TYPE]    || '').replace(/\s+/g, ' ').trim();

    transactions.push(makeTx({
      bookingDate,
      valueDate:  f[COL_VALDATE] || '',
      date,
      payer:      amount > 0 ? payee : '',
      recipient:  amount < 0 ? payee : '',
      purpose,
      type,
      iban:       (f[COL_IBAN] || '').trim(),
      amount,
      creditorId: (f[COL_CREDITOR] || '').trim(),
      mandateRef: (f[COL_MANDATE]  || '').trim(),
      customerRef:(f[COL_CUSTREF]  || '').trim(),
    }));
  }

  transactions.sort((a, b) => a.date - b.date);

  // Sparkasse exports carry no metadata block, so derive the period from the
  // transaction date range (the format has no running balance to report).
  meta.period = periodFromTransactions(transactions);

  return { meta, transactions };
}
