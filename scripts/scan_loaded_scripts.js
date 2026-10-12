const fs = require('fs');

const loadedFiles = [
  'js/adapters/firebaseInit.js',
  'js/adapters/userStore.js',
  'js/adapters/externalStore.js',
  'js/adapters/sessionStore.js',
  'js/adapters/parentAdminStore.js',
  'js/adapters/appSettingsStore.js',
  'js/adapters/manifestCache.js',
  'js/modules/stopwatch.js',
  'js/modules/externalLearning.js',
  'js/modules/parentAdmin.js',
  'js/modules/authPin.js',
  'js/app.js'
];

loadedFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const matches = [];
  lines.forEach((line, idx) => {
    if (line.includes('GAS_API_URL') || line.includes('getGasUrl()') || line.includes('gasApiFetch') || (line.includes('fetch(') && (line.includes('gas') || line.includes('GAS')))) {
      matches.push({ line: idx + 1, text: line.trim() });
    }
  });
  console.log(`\n=== ${file}: ${matches.length} matches ===`);
  matches.forEach(m => console.log(`  L${m.line}: ${m.text.slice(0, 100)}`));
});
