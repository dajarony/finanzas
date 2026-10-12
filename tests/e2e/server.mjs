import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeServer } from '../../server/app.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-e2e-'));
const { server } = makeServer({ dbFile: path.join(dir, 'aura.db'), secure: true });
server.listen(8789, '127.0.0.1');
function shutdown() {
  server.close(() => {
    if (path.dirname(path.resolve(dir)) === path.resolve(os.tmpdir()) && path.basename(dir).startsWith('aura-e2e-')) fs.rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
