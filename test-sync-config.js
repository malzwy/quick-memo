process.env.QUICK_MEMO_SYNC_THRESHOLD = '2';
// No QUICK_MEMO_CONFIG set, will use default path: ~/.quick-memo/config.json

// Require config after setting env
const { getConfigKey } = require('./src/lib/config');

console.log('Config path:', getConfigKey ? 'function exists' : 'missing');
const sync = getConfigKey('sync');
console.log('Sync config:', JSON.stringify(sync, null, 2));
console.log('thresholdAbsolute:', sync?.thresholdAbsolute);
console.log('thresholdPercent:', sync?.thresholdPercent);
