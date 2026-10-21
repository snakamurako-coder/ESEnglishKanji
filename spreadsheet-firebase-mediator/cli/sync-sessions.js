/**
 * Spreadsheet-Firebase Mediator CLI: Session Sync & Daily Reporting
 * 
 * 仲介GAS Web APIへ取り組み作業の集約・日次サマリー送信をトリガーするCLIツール
 * 
 * 実行方法:
 *   node cli/sync-sessions.js [--mediator-url <URL>] [--action <action>]
 */

async function main() {
  const args = process.argv.slice(2);
  const DEFAULT_MEDIATOR_URL = 'https://script.google.com/macros/s/AKfycbw3kHj3mGXxB3tDUBtbnA0D2SqDdlsD9T0ef9oO3GRf3-QqqFdBPyBNcPvdXxxFnbqXfQ/exec';
  let mediatorUrl = DEFAULT_MEDIATOR_URL;
  let action = 'daily_report';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mediator-url' && args[i + 1]) {
      mediatorUrl = args[i + 1];
      i++;
    } else if (args[i] === '--action' && args[i + 1]) {
      action = args[i + 1];
      i++;
    }
  }

  console.log(`==> Syncing sessions via Mediator Web App (${action})...`);
  const res = await fetch(mediatorUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action })
  });

  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const data = await res.json();
  console.log('==> Response:', JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error('[Error]', err.message);
  process.exit(1);
});
