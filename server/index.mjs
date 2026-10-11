import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeServer } from './app.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=process.env.AURA_DATA_DIR || path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
const dbFile=path.join(dataDir,'aura-finanzas.db');
const port=Number(process.env.PORT||8787);
const host='127.0.0.1'; // Privacy invariant: no unauthenticated public listener.
const {server}=makeServer({dbFile,secure:true});
server.listen(port,host,()=>console.log(`Aura Finanzas API → http://${host}:${port} (almacén: ${dbFile})`));
