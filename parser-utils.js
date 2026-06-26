/**
 * Shared CSV parsing utilities used by all bank parsers.
 */

export function parseGermanNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

export function parseGermanDate(str) {
  if (!str) return null;
  const parts = str.trim().split('.');
  if (parts.length !== 3) return null;
  let year = parseInt(parts[2]);
  if (year < 100) year += 2000;
  return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
}

/** Format a Date as DD.MM.YYYY. */
export function formatGermanDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}

/**
 * Build a "DD.MM.YYYY - DD.MM.YYYY" period string from the date range of
 * already-sorted (ascending) transactions. Returns '' when empty.
 */
export function periodFromTransactions(transactions) {
  if (!transactions || transactions.length === 0) return '';
  const first = formatGermanDate(transactions[0].date);
  const last  = formatGermanDate(transactions[transactions.length - 1].date);
  if (!first || !last) return '';
  return first === last ? first : `${first} - ${last}`;
}

export function splitCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let current = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
    i++;
  }
  result.push(current.trim());
  return result;
}

export function cleanLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/**
 * Build a normalised transaction object.
 * Callers supply only the fields they have; everything else defaults to ''.
 */
export function makeTx(partial) {
  const { date, amount } = partial;
  return {
    bookingDate: '',
    valueDate:   '',
    date,
    status:      '',
    payer:       '',
    recipient:   '',
    purpose:     '',
    type:        '',
    iban:        '',
    amount,
    creditorId:  '',
    mandateRef:  '',
    customerRef: '',
    isIncome:  amount > 0,
    isExpense: amount < 0,
    year:      date.getFullYear(),
    month:     date.getMonth(),
    monthKey:  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    ...partial,
  };
}

/**
 * Build a deduplication key for a transaction.
 * Normalizes payee name and purpose to catch minor whitespace differences.
 */
export function dedupKey(tx) {
  const d = tx.date instanceof Date ? tx.date.toISOString().slice(0, 10) : String(tx.date);
  const amt = Math.round(tx.amount * 100);
  const payee = (tx.recipient || tx.payer || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const purp = (tx.purpose || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return d + '|' + amt + '|' + payee + '|' + purp;
}

/**
 * Find the index of the data header row in raw CSV lines for a given bank.
 */
export function findHeaderLineIndex(rawLines, bank) {
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (bank === 'dkb' && line.includes('Buchungsdatum')) return i;
    if (bank === 'ing' && line.startsWith('Buchung;')) return i;
    if (bank === 'sparkasse' && line.includes('Auftragskonto')) return i;
  }
  return -1;
}
