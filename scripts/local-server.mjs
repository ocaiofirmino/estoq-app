import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { handleRequest } from '../lib/router.mjs';
import { sqliteAdapter, getCloudDatabase, initializeDatabase } from '../lib/database.mjs';
import { assertCurrentDatabasePath } from '../lib/migrations/001-estoq.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = process.env.ESTOQ_DATA_DIR || resolve(root, 'data');
await mkdir(dataPath, { recursive: true });
await assertCurrentDatabasePath(dataPath);
const sqlite = new DatabaseSync(resolve(dataPath, 'estoq.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
const initial = JSON.parse(await readFile(resolve(root, 'lib/initial-data.json'), 'utf8'));
const cloud=Boolean(process.env.DATABASE_URL);
const db = cloud ? await getCloudDatabase() : sqliteAdapter(sqlite);
await initializeDatabase(db,initial);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.ico':'image/x-icon', '.json':'application/json', '.webmanifest':'application/manifest+json; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const host = req.headers.host || '127.0.0.1';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) { res.writeHead(403).end('Host não permitido.'); return; }
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 2000000) { res.writeHead(413).end('Arquivo muito grande.'); return; } chunks.push(chunk); }
      const request = new Request(url, { method:req.method, headers:req.headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body:Buffer.concat(chunks) } : {}) });
      const response = await handleRequest(request, db, initial, cloud?'cloud':'local');
      const headers=Object.fromEntries(response.headers);
      const cookies=response.headers.getSetCookie();
      if(cookies.length)headers['set-cookie']=cookies;
      res.writeHead(response.status, headers);
      res.end(await response.text());
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filename = resolve(root, 'public', '.' + pathname);
    if (!filename.startsWith(resolve(root, 'public') + '/')) { res.writeHead(403).end(); return; }
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type':types[extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Página indisponível.');
  }
});
const port = Number(process.env.PORT || 4173);
server.on('error', (error) => {
  const message = error.code === 'EADDRINUSE' ? 'A porta está ocupada. Use PORT=4174 npm run dev.'
    : error.code === 'EPERM' ? 'Este ambiente bloqueou a abertura do servidor. Execute o iniciador pelo terminal do sistema.'
    : error.message;
  console.error('Não foi possível iniciar Estoq:', message);
  sqlite.close();
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Estoq disponível em ${url}\nDados: ${cloud?'Postgres online':dataPath+'/estoq.sqlite'}\nMantenha este terminal aberto. Para encerrar, pressione Ctrl+C.`);
  if (process.env.ESTOQ_OPEN_BROWSER === '1') {
    const browser = spawn('xdg-open', [url], { detached:true, stdio:'ignore' });
    browser.on('error', () => console.log('Abra o endereço acima no seu navegador.'));
    browser.unref();
  }
});
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => server.close(() => { sqlite.close(); process.exit(0); }));
