const TRANSLATIONS = {
  de: {
    // Page
    pageTitle: 'Kontoeinblick — Finanzübersicht',

    // Upload
    uploadHeading: 'Kontoeinblick',
    uploadDesc: 'Lade deinen Kontoauszug als CSV-Export hoch, um deine Finanzen zu visualisieren.',
    uploadPrivacy: '🔒 Alle Daten werden lokal im Browser verarbeitet — es werden keine Daten übertragen.</strong>',
    dropZoneTitle: 'CSV hier ablegen',
    dropZoneOr: 'oder',
    dropZoneBrowse: 'Datei auswählen',
    uploadHint: '💡 Im Online-Banking deiner Bank: Konto → Umsätze → Export → CSV',
    desktopHint: '💻 Desktop empfohlen — das Dashboard ist für große Bildschirme optimiert.',
    mobileDismiss: 'Verstanden, trotzdem öffnen',
    supportedBanksLabel: 'Unterstützte Banken:',
    loadExampleCsv: 'Beispieldaten laden',
    loadExampleGroups: 'Beispielgruppen laden',
    exampleLoaded: 'Beispiel geladen',

    // Feature grid
    featureDashboardTitle: 'Dashboard & Charts',
    featureDashboardDesc: 'Einnahmen, Ausgaben und Guthaben auf einen Blick. Monats- und Tagesverlauf als interaktive Balkendiagramme. Zeitraum frei wählbar.',
    featureSearchTitle: 'Suche & Filter',
    featureSearchDesc: 'Volltextsuche über Empfänger und Verwendungszweck — mit optionaler Groß-/Kleinschreibung. Filter nach Typ, Monat und Mindestbetrag kombinierbar.',
    featureGroupsTitle: 'Gruppen & Kategorien',
    featureGroupsDesc: 'Erstelle Kategorien mit flexiblen Regeln (enthält, beginnt mit, …). Regeln per Klick oder Textauswahl direkt aus der Tabelle hinzufügen. Gruppen als JSON exportieren und wieder importieren.',
    featureQuickTitle: 'Schnell kategorisieren',
    featureQuickDesc: 'In der Transaktionstabelle: <strong>Text markieren</strong> → Button erscheint → Gruppe wählen. Oder auf <strong>＋</strong> am Zeilenende klicken, um Empfänger / Verwendungszweck zuzuweisen.',
    featureMonthTitle: 'Betrag pro Monat',
    featureMonthDesc: 'Monatsübersicht als einfaches Balken- oder <strong>gestapeltes Diagramm</strong> — im Stacked-Modus wird jede Kategorie-Regel als eigene farbige Schicht angezeigt.',
    featureDetailTitle: 'Transaktionsdetails',
    featureDetailDesc: 'Klick auf eine beliebige Zeile zeigt alle Felder als Popup: Buchungsdatum, IBAN, Mandatsreferenz, Gläubiger-ID und zugeordnete Gruppen.',

    // Filters
    labelRange: 'Zeitraum',
    labelYear: 'Jahr',
    labelMonth: 'Monat',
    labelFrom: 'Von',
    labelTo: 'Bis',

    // Range pills
    rangeAll: 'Alle',
    rangeCur: 'Aktueller Monat',
    rangePrev: 'Letzter Monat',
    rangeCuryr: 'Dieses Jahr',
    rangePrevyr: 'Letztes Jahr',

    // Selects
    allYears: 'Alle Jahre',
    allMonths: 'Alle Monate',
    monthsFilterActive: (n) => `${n} Monat${n !== 1 ? 'e' : ''}`,
    allTypes: 'Alle Typen',
    incomeOnly: 'Nur Einnahmen',
    expenseOnly: 'Nur Ausgaben',

    // Month names
    months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],

    // KPI labels
    kpiIncome: 'Gesamteinnahmen',
    kpiExpense: 'Gesamtausgaben',
    kpiNet: 'Netto-Cashflow',
    kpiBalance: 'Kontostand',
    kpiTxCount: 'Transaktionen',
    kpiSavings: 'Sparquote',
    kpiAvgMonth: 'Ø pro Monat',
    kpiPositive: 'Positiver Cashflow',
    kpiNegative: 'Negativer Cashflow',
    kpiAsOf: 'Stand',
    kpiTransactions: 'Transaktionen',
    kpiSavingsRate: 'Sparquote',

    // Chart titles
    chartMonthly: 'Monatliche Einnahmen vs. Ausgaben',
    chartMonthlyTip: 'Zeigt die monatlichen Einnahmen (grün) und Ausgaben (rot) als Balkendiagramm. Jeder Balken steht für einen Monat. Nützlich, um saisonale Schwankungen und Trends im monatlichen Cashflow zu erkennen.',
    chartBalance: 'Kumulativer Cashflow',
    chartBalanceTip: 'Stellt den kumulativen Cashflow als Linie dar — Monat für Monat wird der Saldo (Einnahmen minus Ausgaben) aufaddiert. Nützlich, um zu sehen, ob dein Vermögen wächst oder schrumpft.',
    chartBalanceSub: 'Laufende Summe aller Ein-/Auszahlungen im gewählten Zeitraum',
    chartMerchants: 'Top Gegenparteien: Einnahmen & Ausgaben',
    chartMerchantsTip: 'Listet die Top-Gegenparteien nach Gesamtbetrag auf, getrennt nach Einnahmen (links) und Ausgaben (rechts). Nützlich, um zu sehen, bei wem du am meisten ausgibst oder von wem du Geld bekommst.',
    largestHeading: 'Größte Transaktionen',
    largestTip: 'Die 5 größten Einnahmen und Ausgaben im gewählten Zeitraum, sortiert nach Betrag.',
    chartIncome: 'Einnahmen',
    chartExpenses: 'Ausgaben',
    chartCumulative: 'Kumulativer Cashflow',
    chartUnknown: 'Unbekannt',

    // Transaction table
    tableHeading: 'Transaktionen',
    tableTip: 'Alle Transaktionen im gewählten Zeitraum. Suche nach Empfänger oder Verwendungszweck, filtere nach Betrag und Typ. Klicke auf eine Zeile für alle Details. Markiere Text, um Gruppen zuzuweisen.',
    tableSearch: 'Empfänger, Verwendungszweck suchen…',
    tableDate: 'Datum',
    tablePayee: 'Empfänger',
    tablePurpose: 'Verwendungszweck',
    tableType: 'Typ',
    tableAmount: 'Betrag',
    tableEmpty: 'Keine Transaktionen gefunden.',
    tableSelectHint: 'Text markieren → Gruppe zuweisen',
    tableFiltered: 'gefiltert',
    tableTransaction: 'Transaktion',
    tableTransactions: 'Transaktionen',
    tableShowing: 'Zeige',
    tableOf: 'von',

    // Filter chart
    filterChartHeading: 'Gefiltertes Ergebnis – Betrag pro Tag',
    filterChartTip: 'Zeigt den täglichen Verlauf von Einnahmen und Ausgaben basierend auf den aktuell aktiven Filtern (Suche, Gruppe, Monat usw.). Jeder Balken ist ein Tag. Nützlich zur detaillierten Analyse gefilterter Zeiträume.',
    filterChartHint: 'Filter anwenden, um den Tagesverlauf anzuzeigen.',
    filterChartIncome: 'Einnahmen',
    filterChartExpenses: 'Ausgaben',
    monthChartHeading: 'Betrag pro Monat',
    monthChartTip: 'Monatsübersicht als Balken- oder gestapeltes Diagramm. Im gestapelten Modus werden die Beträge pro Gruppe farblich aufgeschlüsselt. Nützlich, um monatliche Ausgabenmuster pro Kategorie zu erkennen.',
    monthChartIncome: 'Einnahmen',
    monthChartExpenses: 'Ausgaben',
    monthChartUngrouped: 'Ohne Gruppe',

    // Amount filter
    amountAll: 'Alle Beträge',
    amountMin: 'Min. Betrag',

    // Misc
    loadNewFile: '📂 Neue Datei laden',
    resetFilters: 'Zurücksetzen',
    tableExportCsv: '📥 CSV',

    // Groups / categories
    groupsHeading: 'Gruppen',
    groupsTip: 'Lege Kategorien mit Regeln an (z. B. enthält "EDEKA" → Gruppe "Lebensmittel"). Regeln werden automatisch auf alle Transaktionen angewandt. Nutze Export/Import, um Gruppen dauerhaft zu sichern.',
    groupsNew: 'Neue Gruppe',
    groupsName: 'Gruppenname…',
    groupsAddRule: 'Aktuelle Suche als Regel hinzufügen',
    groupsNoRules: 'Keine Regeln',
    groupsExport: 'Gruppen exportieren',
    groupsDirtyHint: '⚠️ Änderungen werden nicht gespeichert — exportiere die Gruppen, um sie beim nächsten Mal wieder zu laden.',
    groupsImport: 'Gruppen importieren',
    groupsDelete: 'Löschen',
    groupsDeleteRule: '×',
    groupsFieldAny: 'Beliebiges Feld',
    groupsFieldPayee: 'Empfänger',
    groupsFieldPurpose: 'Verwendungszweck',
    groupsOpContains: 'enthält',
    groupsOpEquals: 'ist gleich',
    groupsOpStartsWith: 'beginnt mit',
    groupsOpEndsWith: 'endet mit',
    groupsOpRegex: 'Regex',
    groupsFilterAll: 'Alle Gruppen',
    groupsFilterNone: 'Ohne Gruppe',
    groupsFilterActive: (n) => `${n} Gruppe${n !== 1 ? 'n' : ''}`,
    groupsMatches: (n) => `${n} Treffer`,
    groupsUploadHint: 'Gespeicherte Gruppen laden (optional)',
    groupsAddToGroup: 'Zu Gruppe hinzufügen',
    groupsCtxNewName: 'Gruppenname…',
    errorParsing: 'Fehler beim Lesen der Datei: ',

    // Tutorial / hints
    tutorialHeading: 'Tutorial & Hinweise',
    tutorialCsvTitle: '📥 CSV aus dem Online-Banking herunterladen',
    tutorialDkbDesc: 'Im DKB Online-Banking unter Konto → Umsätze → Export als CSV herunterladen.',
    tutorialDkbLink: '→ Zum DKB Banking',
    tutorialIngDesc: 'Im ING Online-Banking unter Konto → Umsätze → Export als CSV herunterladen.',
    tutorialIngLink: '→ Zum ING Banking',
    tutorialSparkasseDesc: 'Im Sparkasse Online-Banking unter Konto → Umsätze → Export als CSV herunterladen.',
    tutorialSparkasseLink: '→ Zum Sparkasse Banking',
    tutorialCsvDesktopHint: 'Hinweis: Der CSV-Export ist oft nur in der Desktop-Version des Online-Bankings verfügbar. Am besten wählst du einen möglichst großen Zeitraum (z. B. „letzte 12 Monate" oder „alle Umsätze"), damit du später alle Daten zur Verfügung hast – nachträglich nachladen ist jederzeit möglich.',
    tutorialGroupsTitle: '🏷️ Gruppen & lokale Speicherung',
    tutorialGroupsDesc: 'Gruppen werden <strong>nur lokal im Browser</strong> gespeichert. Sobald du den Tab schließt, sind sie weg — daher: Exportiere deine Gruppen als JSON-Datei (<strong>„Gruppen exportieren“</strong>) und hebe sie sicher auf. Beim nächsten Mal lädst du die JSON-Datei einfach über die Schaltfläche auf der Startseite oder per <strong>„Gruppen importieren“</strong> im Dashboard wieder hoch.',
    tutorialGroupsWorkflow: '<strong>Empfohlener Workflow:</strong> Nach dem Anlegen deiner Gruppen → exportieren → JSON ablegen. Bei neuer Sitzung: CSV laden → Gruppen-JSON importieren → fertig.',

    // Feature request
    featureRequest: '💡 Feature wünschen',
    featureRequestTip: 'Du hast eine Idee zur Verbesserung? Schick mir einfach eine E-Mail an kontoeinblick@gmx.de – ich freue mich über dein Feedback!',
    featureRequestTitle: '💡 Feature-Wünsche & Feedback',
    featureRequestDesc: 'Du hast eine Idee oder vermisst eine Funktion? Schreib mir eine E-Mail – ich freue mich über Vorschläge und nehme jedes Feedback ernst.',

    // Open source
    featureOpenSourceTitle: 'Open Source',
    featureOpenSourceDesc: 'Kontoeinblick ist Open Source. Der vollständige Quellcode ist auf GitHub verfügbar.',
    featureOpenSourceLink: 'Quellcode auf GitHub',

    // Footer
    footerImprint: 'Impressum',
    footerPrivacy: 'Datenschutz',
    footerPrivacyNote: '🔒 Alle Daten bleiben lokal in deinem Browser',
    footerPrivacyTip: 'Kontoeinblick verarbeitet alle hochgeladenen CSV-Dateien ausschließlich im Arbeitsspeicher deines Browsers. Es werden keine Daten an Server übertragen, gespeichert oder analysiert. Nach dem Schließen des Tabs oder Neuladen einer Datei werden alle Daten verworfen. Weder ich als Betreiber noch Dritte haben Zugriff auf deine Finanzdaten.',
    footerDonate: '☕ Kaffee spendieren',
    footerSource: 'Quellcode',
    headerDonate: '☕',
    headerDonateTip: 'Unterstützung via PayPal – Kaffee spendieren',
    langDe: 'Deutsch',
    langEn: 'English',

    // PDF export
    pdfExportBtn: '🖨 PDF',
    pdfModalTitle: 'PDF exportieren',
    pdfModalDesc: 'Wähle die Abschnitte, die im PDF enthalten sein sollen.',
    pdfSectionKpi: 'Kennzahlen (KPI-Karten)',
    pdfSectionChartMonthly: 'Monatliche Einnahmen vs. Ausgaben',
    pdfSectionChartBalance: 'Kumulativer Cashflow',
    pdfSectionChartMerchants: 'Top Gegenparteien',
    pdfSectionChartLargest: 'Größte Transaktionen',
    pdfSectionChartMonthAmount: 'Betrag pro Monat',
    pdfSectionTable: 'Transaktionstabelle (alle gefilterten Zeilen)',
    pdfSelectAll: 'Alle auswählen',
    pdfCancel: 'Abbrechen',
    pdfPrint: '🖨 Drucken / Als PDF speichern',
    pdfNoSectionWarning: 'Bitte mindestens einen Abschnitt auswählen.',

    mergeHeading: 'CSV-Dateien zusammenführen',
    mergeDesc: 'Lade mehrere CSV-Dateien derselben Bank hoch, um sie zu einer Datei zusammenzuführen (z. B. verschiedene Zeiträume).',
    mergeDropHint: 'CSV-Dateien auswählen',
    mergeDownload: '📥 Merged CSV herunterladen',
    mergeUseNow: 'Im Dashboard anzeigen',
    mergeReset: 'Zurücksetzen',
    mergeStatusLoading: 'Lade Dateien…',
    mergeHint: '🔗 Mehrere CSV-Dateien zusammenführen (z. B. verschiedene Zeiträume) →',
    mergeStatusOk: 'Alle %d Dateien geladen ✓',
    mergeStatusBank: 'Bank: %s',
    mergeStatusTxCount: 'Insgesamt %d Transaktionen (davon %d neu, %d Duplikate entfernt)',
    mergeStatusEmpty: 'Keine gültigen Transaktionen in den ausgewählten Dateien.',
    mergeErrDifferentBanks: 'Die ausgewählten Dateien stammen von verschiedenen Banken. Nur Dateien derselben Bank können zusammengeführt werden.',
    mergeErrIncompatible: 'Die CSV-Formate sind nicht kompatibel und können nicht zusammengeführt werden.',
  },

  en: {
    // Page
    pageTitle: 'Kontoeinblick — Personal Finance Dashboard',

    // Upload
    uploadHeading: 'Kontoeinblick',
    uploadDesc: 'Upload your bank statement CSV export to visualize your finances.',
    uploadPrivacy: '🔒 All processing happens locally in your browser — no data is ever sent anywhere.',
    dropZoneTitle: 'Drop your CSV here',
    dropZoneOr: 'or',
    dropZoneBrowse: 'click to browse',
    uploadHint: '💡 In your bank\'s online banking: Account → Transactions → Export → CSV',
    desktopHint: '💻 Desktop recommended — the dashboard is optimised for large screens.',
    mobileDismiss: 'Got it, open anyway',
    supportedBanksLabel: 'Supported banks:',
    loadExampleCsv: 'Load example data',
    loadExampleGroups: 'Load example groups',
    exampleLoaded: 'Example loaded',

    // Feature grid
    featureDashboardTitle: 'Dashboard & Charts',
    featureDashboardDesc: 'Income, expenses and balance at a glance. Monthly and daily charts as interactive bar diagrams. Freely selectable date range.',
    featureSearchTitle: 'Search & Filter',
    featureSearchDesc: 'Full-text search across payee and purpose — with optional case sensitivity. Combine filters for type, month and minimum amount.',
    featureGroupsTitle: 'Groups & Categories',
    featureGroupsDesc: 'Create categories with flexible rules (contains, starts with, …). Add rules by clicking or selecting text directly in the table. Export and import groups as JSON.',
    featureQuickTitle: 'Quick categorise',
    featureQuickDesc: 'In the transaction table: <strong>select text</strong> → button appears → choose a group. Or click <strong>＋</strong> at the end of a row to assign payee / purpose.',
    featureMonthTitle: 'Amount per Month',
    featureMonthDesc: 'Monthly overview as a simple bar or <strong>stacked chart</strong> — in stacked mode each category rule is shown as its own coloured layer.',
    featureDetailTitle: 'Transaction Details',
    featureDetailDesc: 'Click any row to see all fields as a popup: booking date, IBAN, mandate reference, creditor ID and assigned groups.',

    // Filters
    labelRange: 'Range',
    labelYear: 'Year',
    labelMonth: 'Month',
    labelFrom: 'From',
    labelTo: 'To',

    // Range pills
    rangeAll: 'All',
    rangeCur: 'Current Month',
    rangePrev: 'Last Month',
    rangeCuryr: 'This Year',
    rangePrevyr: 'Last Year',

    // Selects
    allYears: 'All years',
    allMonths: 'All months',
    monthsFilterActive: (n) => `${n} month${n !== 1 ? 's' : ''}`,
    allTypes: 'All types',
    incomeOnly: 'Income only',
    expenseOnly: 'Expenses only',

    // Month names
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

    // KPI labels
    kpiIncome: 'Total Income',
    kpiExpense: 'Total Expenses',
    kpiNet: 'Net Cash Flow',
    kpiBalance: 'Account Balance',
    kpiTxCount: 'Transactions',
    kpiSavings: 'Savings Rate',
    kpiAvgMonth: 'Avg/month',
    kpiPositive: 'Positive cash flow',
    kpiNegative: 'Negative cash flow',
    kpiAsOf: 'as of',
    kpiTransactions: 'transactions',
    kpiSavingsRate: 'savings rate',

    // Chart titles
    chartMonthly: 'Monthly Income vs. Expenses',
    chartMonthlyTip: 'Shows monthly income (green) and expenses (red) as a bar chart. Each bar is one month. Useful for spotting seasonal patterns and monthly cash flow trends.',
    chartBalance: 'Cumulative Cash Flow',
    chartBalanceTip: 'Plots the cumulative cash flow as a line — each month\'s net (income minus expenses) is added to the running total. Useful for seeing whether your wealth is growing or shrinking.',
    chartBalanceSub: 'Running total of all money in/out over the selected period',
    chartMerchants: 'Top Counterparties: Income & Expenses',
    chartMerchantsTip: 'Lists the top counterparties by total amount, split by income (left) and expenses (right). Useful for seeing who you spend the most with or who pays you the most.',
    largestHeading: 'Largest Transactions',
    largestTip: 'The 5 largest income and expense transactions in the selected period, sorted by amount.',
    chartIncome: 'Income',
    chartExpenses: 'Expenses',
    chartCumulative: 'Cumulative cash flow',
    chartUnknown: 'Unknown',

    // Transaction table
    tableHeading: 'Transactions',
    tableTip: 'All transactions in the selected period. Search by payee or purpose, filter by amount and type. Click any row for full details. Select text to quickly assign groups.',
    tableSearch: 'Search payee, purpose…',
    tableDate: 'Date',
    tablePayee: 'Payee',
    tablePurpose: 'Purpose',
    tableType: 'Type',
    tableAmount: 'Amount',
    tableEmpty: 'No transactions found.',
    tableSelectHint: 'Select text → assign group',
    tableFiltered: 'filtered',
    tableTransaction: 'transaction',
    tableTransactions: 'transactions',
    tableShowing: 'Showing',
    tableOf: 'of',

    // Filter chart
    filterChartHeading: 'Filtered Result – Amount per Day',
    filterChartTip: 'Shows the daily breakdown of income and expenses based on your currently active filters (search, group, month, etc.). Each bar is one day. Useful for detailed analysis of filtered periods.',
    filterChartHint: 'Apply a filter to display the daily breakdown.',
    filterChartIncome: 'Income',
    filterChartExpenses: 'Expenses',
    monthChartHeading: 'Amount per Month',
    monthChartTip: 'Monthly overview as a bar or stacked chart. In stacked mode, amounts per group are colour-coded. Useful for spotting monthly spending patterns per category.',
    monthChartIncome: 'Income',
    monthChartExpenses: 'Expenses',
    monthChartUngrouped: 'Ungrouped',

    // Amount filter
    amountAll: 'All amounts',
    amountMin: 'Min. amount',

    // Misc
    loadNewFile: '📂 Load new file',
    resetFilters: 'Reset',
    tableExportCsv: '📥 CSV',
    errorParsing: 'Error parsing file: ',

    // Groups / categories
    groupsHeading: 'Groups',
    groupsTip: 'Create categories with rules (e.g. contains "EDEKA" → group "Groceries"). Rules are automatically applied to all transactions. Use export/import to persist groups permanently.',
    groupsNew: 'New Group',
    groupsName: 'Group name…',
    groupsAddRule: 'Add current search as rule',
    groupsNoRules: 'No rules',
    groupsExport: 'Export groups',
    groupsDirtyHint: '⚠️ Changes are not saved — export your groups to reload them next time.',
    groupsImport: 'Import groups',
    groupsDelete: 'Delete',
    groupsDeleteRule: '×',
    groupsFieldAny: 'Any field',
    groupsFieldPayee: 'Payee',
    groupsFieldPurpose: 'Purpose',
    groupsOpContains: 'contains',
    groupsOpEquals: 'equals',
    groupsOpStartsWith: 'starts with',
    groupsOpEndsWith: 'ends with',
    groupsOpRegex: 'regex',
    groupsFilterAll: 'All groups',
    groupsFilterNone: 'Ungrouped',
    groupsFilterActive: (n) => `${n} group${n !== 1 ? 's' : ''}`,
    groupsMatches: (n) => `${n} match${n !== 1 ? 'es' : ''}`,
    groupsUploadHint: 'Load saved groups (optional)',
    groupsAddToGroup: 'Add to group',
    groupsCtxNewName: 'Group name…',

    // Tutorial / hints
    tutorialHeading: 'Tutorial & Tips',
    tutorialCsvTitle: '📥 Download CSV from online banking',
    tutorialDkbDesc: 'In DKB online banking, navigate to Account → Transactions → Export and download as CSV.',
    tutorialDkbLink: '→ Go to DKB Banking',
    tutorialIngDesc: 'In ING online banking, navigate to Account → Transactions → Export and download as CSV.',
    tutorialIngLink: '→ Go to ING Banking',
    tutorialSparkasseDesc: 'In Sparkasse online banking, navigate to Account → Transactions → Export and download as CSV.',
    tutorialSparkasseLink: '→ Go to Sparkasse Banking',
    tutorialCsvDesktopHint: 'Note: CSV export is often only available in the desktop version of online banking. Best to select the largest possible date range (e.g. "last 12 months" or "all transactions") so you have all the data available — you can always load additional files later.',
    tutorialGroupsTitle: '🏷️ Groups & local storage',
    tutorialGroupsDesc: 'Groups are stored <strong>only locally in your browser</strong>. They will be lost when you close the tab — so make sure to export your groups as a JSON file (<strong>"Export groups"</strong>) and keep it safe. Next time, simply upload the JSON file via the button on the start screen or <strong>"Import groups"</strong> in the dashboard.',
    tutorialGroupsWorkflow: '<strong>Recommended workflow:</strong> After creating your groups → export → save your JSON. In a new session: load CSV → import groups JSON → done.',

    // Feature request
    featureRequest: '💡 Request a feature',
    featureRequestTip: 'Got an idea for improvement? Just send me an email at kontoeinblick@gmx.de – I\'d love to hear your feedback!',
    featureRequestTitle: '💡 Feature Requests & Feedback',
    featureRequestDesc: 'Have an idea or missing a feature? Drop me an email – I\'d love to hear suggestions and take every feedback seriously.',

    // Open source
    featureOpenSourceTitle: 'Open Source',
    featureOpenSourceDesc: 'Kontoeinblick is open source. The full source code is available on GitHub.',
    featureOpenSourceLink: 'Source code on GitHub',

    // Footer
    footerImprint: 'Legal Notice',
    footerPrivacy: 'Privacy Policy',
    footerPrivacyNote: '🔒 All data stays local in your browser',
    footerPrivacyTip: 'Kontoeinblick processes all uploaded CSV files exclusively in your browser\'s memory. No data is transmitted to, stored on, or analysed by any server. All data is discarded when you close the tab or load a new file. Neither I as the operator nor any third party has access to your financial data.',
    footerDonate: '☕ Buy me a coffee',
    footerSource: 'Source Code',
    headerDonate: '☕',
    headerDonateTip: 'Support via PayPal – buy me a coffee',
    langDe: 'German',
    langEn: 'English',

    // PDF export
    pdfExportBtn: '🖨 PDF',
    pdfModalTitle: 'Export PDF',
    pdfModalDesc: 'Select the sections to include in the PDF.',
    pdfSectionKpi: 'Key metrics (KPI cards)',
    pdfSectionChartMonthly: 'Monthly Income vs. Expenses',
    pdfSectionChartBalance: 'Cumulative Cash Flow',
    pdfSectionChartMerchants: 'Top Counterparties',
    pdfSectionChartLargest: 'Largest Transactions',
    pdfSectionChartMonthAmount: 'Amount per Month',
    pdfSectionTable: 'Transaction table (all filtered rows)',
    pdfSelectAll: 'Select all',
    pdfCancel: 'Cancel',
    pdfPrint: '🖨 Print / Save as PDF',
    pdfNoSectionWarning: 'Please select at least one section.',

    mergeHeading: 'Merge CSV Files',
    mergeDesc: 'Upload multiple CSV files from the same bank to merge them into one file (e.g. different time periods).',
    mergeDropHint: 'Select CSV files',
    mergeDownload: '📥 Download Merged CSV',
    mergeUseNow: 'Show in Dashboard',
    mergeReset: 'Reset',
    mergeStatusLoading: 'Loading files…',
    mergeHint: '🔗 Merge multiple CSV files (e.g. different time periods) →',
    mergeStatusOk: 'All %d files loaded ✓',
    mergeStatusBank: 'Bank: %s',
    mergeStatusTxCount: '%d total transactions (%d new, %d duplicates removed)',
    mergeStatusEmpty: 'No valid transactions in the selected files.',
    mergeErrDifferentBanks: 'The selected files are from different banks. Only files from the same bank can be merged.',
    mergeErrIncompatible: 'The CSV formats are not compatible and cannot be merged.',
  },
};

let currentLang = 'de';

function setLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('dkb-lang', lang);
  applyStaticTranslations();
}

function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS['en'][key] ?? key;
}

function applyStaticTranslations() {
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;
    const val = t(key);
    if (attr) {
      el.setAttribute(attr, val);
    } else {
      el.innerHTML = val;
    }
  });
  // Update lang toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function initI18n() {
  const saved = localStorage.getItem('dkb-lang');
  currentLang = (saved === 'en' || saved === 'de') ? saved : 'de';
  applyStaticTranslations();
}

export { t, setLang, initI18n, applyStaticTranslations };
