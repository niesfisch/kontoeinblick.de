/**
 * Group/category engine.
 *
 * A group: { id, name, color, rules: [{ field, op, value, caseSensitive }] }
 * field: 'payee' | 'purpose' | 'any'
 * op:    'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex'
 *
 * Transactions are tagged with an array of matching group ids after applyGroups().
 */

const GROUP_COLORS = [
  '#2563eb','#16a34a','#dc2626','#d97706','#7c3aed',
  '#0891b2','#db2777','#65a30d','#ea580c','#6366f1',
  '#0d9488','#b45309','#9333ea','#be123c','#15803d',
];

let groups = []; // array of group objects
let _nextColorIdx = 0;

function nextColor() {
  return GROUP_COLORS[_nextColorIdx++ % GROUP_COLORS.length];
}

function createGroup(name, color) {
  const g = { id: crypto.randomUUID(), name, color: color || nextColor(), rules: [] };
  groups.push(g);
  return g;
}

function deleteGroup(id) {
  groups = groups.filter(g => g.id !== id);
}

function getGroups() { return groups; }

function getGroup(id) { return groups.find(g => g.id === id); }

function addRule(groupId, rule) {
  const g = getGroup(groupId);
  if (!g) return;
  g.rules.push({ id: crypto.randomUUID(), ...rule });
}

function deleteRule(groupId, ruleId) {
  const g = getGroup(groupId);
  if (!g) return;
  g.rules = g.rules.filter(r => r.id !== ruleId);
}

function updateRule(groupId, ruleId, patch) {
  const g = getGroup(groupId);
  if (!g) return;
  const r = g.rules.find(r => r.id === ruleId);
  if (r) Object.assign(r, patch);
}

function matchRule(rule, tx) {
  const fields = rule.field === 'any'
    ? [tx.recipient, tx.payer, tx.purpose]
    : rule.field === 'payee'
      ? [tx.recipient, tx.payer]
      : [tx.purpose];

  return fields.some(raw => {
    if (!raw) return false;
    if (rule.op === 'regex') {
      try {
        const flags = rule.caseSensitive ? '' : 'i';
        return new RegExp(rule.value, flags).test(raw);
      } catch { return false; }
    }
    const haystack = rule.caseSensitive ? raw : raw.toLowerCase();
    const needle   = rule.caseSensitive ? rule.value : rule.value.toLowerCase();
    switch (rule.op) {
      case 'contains':    return haystack.includes(needle);
      case 'equals':      return haystack === needle;
      case 'startsWith':  return haystack.startsWith(needle);
      case 'endsWith':    return haystack.endsWith(needle);
      default:            return false;
    }
  });
}

function matchGroup(group, tx) {
  return group.rules.some(r => matchRule(r, tx));
}

/** Tag every transaction with matching group ids. Mutates tx.groups. */
function applyGroups(transactions) {
  transactions.forEach(tx => {
    tx.groups = groups.filter(g => g.rules.length > 0 && matchGroup(g, tx)).map(g => g.id);
  });
}

function exportGroups() {
  return JSON.stringify(groups, null, 2);
}

function importGroups(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Invalid groups file');
  groups = parsed;
  _nextColorIdx = groups.length % GROUP_COLORS.length;
}

export {
  getGroups, getGroup, createGroup, deleteGroup,
  addRule, deleteRule, updateRule, applyGroups, exportGroups, importGroups,
  GROUP_COLORS,
};
