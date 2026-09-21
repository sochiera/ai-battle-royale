'use strict';
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
}

const serverDir = path.resolve(__dirname, '..');
const match = arg('match', '45');
const bots = arg('bots', '8');
const port = arg('port', '8611');

const env = {
  ...process.env,
  PORT: port,
  HOST: '127.0.0.1',
  MATCH_DURATION: String(match),
  DATA_DIR: path.join(os.tmpdir(), 'orlywro-qa-data'),
  HOST_RATE_MAX: '200',
  JOIN_RATE_MAX: '200',
  REJOIN_RATE_MAX: '200',
  WS_MAX_PER_IP: '50',
};

const server = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, env });
server.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
server.stderr.on('data', (d) => process.stderr.write('[server!] ' + d));

async function waitHealth(tries) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/healthz');
      if (res.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  if (!(await waitHealth(40))) {
    console.error('[qa] serwer nie wystartowal');
    server.kill();
    process.exit(1);
  }
  console.log('[qa] serwer gotowy na porcie ' + port);
  const seconds = String(Number(match) + 6);
  const child = spawn(process.execPath, [
    'bots/simulate.js',
    '--host=http://127.0.0.1:' + port,
    '--bots=' + bots,
    '--seconds=' + seconds,
    '--drop=1',
  ], { cwd: serverDir, stdio: 'inherit' });
  child.on('exit', (code) => {
    server.kill();
    setTimeout(() => process.exit(code || 0), 300);
  });
})();
