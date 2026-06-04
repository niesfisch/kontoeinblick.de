/**
 * ING-DiBa CSV parser.
 *
 * Expected format (semicolon-separated, ISO-8859-1):
 *   Metadata block (key;value pairs):
 *     IBAN; Kontoname; Bank; Kunde; Zeitraum; Saldo (optional)
 *   Followed by a blank line, then the data header:
 *
 *   Variant A – with running balance:
 *     Buchung; Wertstellungsdatum; Auftraggeber/Empfänger; Buchungstext;
 *     Verwendungszweck; Saldo; Währung; Betrag; Währung
 *
 *   Variant B – without running balance:
 *     Buchung; Wertstellungsdatum; Auftraggeber/Empfänger; Buchungstext;
 *     Verwendungszweck; Betrag; Währung
 *
 * The parser auto-detects which variant is present.
 * Note: ING exports in descending date order; results are sorted ascending.
 */

import { parseGermanNumber, parseGermanDate, splitCSVLine, makeTx } from './parser-utils.js';

export const BANK_ID   = 'ing';
export const BANK_NAME = 'ING-DiBa';

/** Returns true when the raw line array looks like an ING-DiBa export. */
export function detect(lines) {
  const header = lines.slice(0, 15).join('\n');
  return header.includes('Bank;ING') || header.includes('Bank; ING');
}

/** Parse pre-split lines and return { meta, transactions }. */
export function parse(lines) {
  const meta = { bank: BANK_ID, bankName: BANK_NAME };

  // Metadata block: key;value pairs before the data table
  for (let i = 0; i < 15 && i < lines.length; i++) {
    const parts = lines[i].split(';').map(s => s.trim());
    if (parts[0] === 'IBAN')      meta.iban        = parts[1];
    if (parts[0] === 'Zeitraum')  meta.period      = parts[1];
    if (parts[0] === 'Kontoname') meta.accountType = parts[1];
    if (parts[0] === 'Saldo') {
      meta.balanceRaw = parts[1] + (parts[2] ? ' ' + parts[2] : '');
      meta.balance    = parseGermanNumber(parts[1]);
    }
  }

  // Data header row starts with "Buchung;"
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Buchung;')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('ING: Header-Zeile (Buchung) nicht gefunden.');

  // Detect variant by checking whether "Saldo" appears as a column header
  const headers   = splitCSVLine(lines[headerIdx]);
  const hasSaldo  = headers.includes('Saldo');

  const COL_DATE    = 0; // Buchung
  const COL_VALDATE = 1; // Wertstellungsdatum
  const COL_PAYEE   = 2; // Auftraggeber/Empfänger
  const COL_TYPE    = 3; // Buchungstext
  const COL_PURPOSE = 4; // Verwendungszweck
  const COL_AMOUNT  = hasSaldo ? 7 : 5; // Betrag

  const transactions = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = splitCSVLine(line);
    if (f.length <= COL_AMOUNT) continue;

    const bookingDate = f[COL_DATE];
    const date = parseGermanDate(bookingDate);
    if (!date) continue;

    const amount  = parseGermanNumber(f[COL_AMOUNT]);
    // ING has a single Auftraggeber/Empfänger field — map to payer/recipient by sign
    const payee   = (f[COL_PAYEE]   || '').replace(/\s+/g, ' ').trim();
    const purpose = (f[COL_PURPOSE] || '').replace(/\s+/g, ' ').trim();
    const type    = (f[COL_TYPE]    || '').replace(/\s+/g, ' ').trim();

    transactions.push(makeTx({
      bookingDate,
      valueDate: f[COL_VALDATE] || '',
      date,
      payer:     amount > 0 ? payee : '',
      recipient: amount < 0 ? payee : '',
      purpose,
      type,
      amount,
    }));
  }

  transactions.sort((a, b) => a.date - b.date);
  return { meta, transactions };
}
