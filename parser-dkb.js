/**
 * Deutsche Kreditbank (DKB) CSV parser.
 *
 * Expected format (semicolon-separated, UTF-8):
 *   Line 0: "<account type>";"<IBAN>"
 *   Line 1: "Zeitraum:";"<period>"
 *   Line 2: "Kontostand vom <date>:";"<balance> €"
 *   Line 3: (empty)
 *   Line 4: header row starting with "Buchungsdatum"
 *   Line 5+: data rows
 *
 * Columns: Buchungsdatum; Wertstellung; Status; Zahlungspflichtige*r;
 *          Zahlungsempfänger*in; Verwendungszweck; Umsatztyp; IBAN;
 *          Betrag (€); Gläubiger-ID; Mandatsreferenz; Kundenreferenz
 */

import { parseGermanNumber, parseGermanDate, splitCSVLine, makeTx } from './parser-utils.js';

export const BANK_ID   = 'dkb';
export const BANK_NAME = 'Deutsche Kreditbank (DKB)';

/** Returns true when the raw line array looks like a DKB export. */
export function detect(lines) {
  for (const line of lines.slice(0, 15)) {
    if (line.includes('Buchungsdatum')) return true;
  }
  return false;
}

/** Parse pre-split lines and return { meta, transactions }. */
export function parse(lines) {
  const meta = { bank: BANK_ID, bankName: BANK_NAME };

  const parseLine = (l) => l.split(';').map(s => s.trim().replace(/^"|"$/g, ''));

  if (lines[0]) { const p = parseLine(lines[0]); meta.accountType = p[0]; meta.iban = p[1]; }
  if (lines[1]) { meta.period = parseLine(lines[1])[1]; }
  if (lines[2]) {
    const p = parseLine(lines[2]);
    meta.balanceRaw = p[1];
    meta.balance    = parseGermanNumber(p[1].replace('€', '').trim());
    const m = lines[2].match(/(\d{2}\.\d{2}\.\d{4})/);
    if (m) meta.balanceDate = m[1];
  }

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Buchungsdatum')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('DKB: Header-Zeile (Buchungsdatum) nicht gefunden.');

  const transactions = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = splitCSVLine(line);
    if (f.length < 9) continue;

    const [bookingDate, valueDate, status, payer, recipient, purpose, type, iban, amountRaw,
           creditorId, mandateRef, customerRef] = f;

    const date = parseGermanDate(bookingDate);
    if (!date) continue;

    transactions.push(makeTx({
      bookingDate, valueDate, date, status,
      payer:      payer.replace(/\s+/g, ' ').trim(),
      recipient:  recipient.replace(/\s+/g, ' ').trim(),
      purpose:    purpose.replace(/\s+/g, ' ').trim(),
      type, iban,
      amount:     parseGermanNumber(amountRaw),
      creditorId, mandateRef, customerRef,
    }));
  }

  transactions.sort((a, b) => a.date - b.date);
  return { meta, transactions };
}
