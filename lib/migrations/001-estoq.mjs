import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

// Conversão dos identificadores anteriores; o restante da aplicação usa Estoq.
export const LEGACY_LOCAL_DATABASE = 'petfun.sqlite';
const tables = [
  ['petfun_workspace', 'estoq_workspace'],
  ['estoquevet_sessions', 'estoq_sessions'],
  ['estoquevet_login_limits', 'estoq_login_limits'],
];
const legacyIndex = 'estoquevet_sessions_expiry';
const legacyCookie = 'estoquevet_session';
const legacySource = 'PETFUN_Controle_Estoque_Reformulado.xlsx';
export const SOURCE_FILENAME = 'Estoq_Controle_Estoque_Reformulado.xlsx';

export function migrateBrandState(state) {
  if (state.source?.file !== legacySource) return state;
  return {...state, source:{...state.source, file:SOURCE_FILENAME}};
}

export async function assertCurrentDatabasePath(folder) {
  try { await access(resolve(folder, LEGACY_LOCAL_DATABASE)); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('Há uma base anterior neste diretório. Encerre o servidor e execute npm run migrate:brand antes de iniciar Estoq.');
}

export async function migrateBrandSchema(db) {
  const postgres = db.engine === 'postgres';
  const query = postgres
    ? "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()"
    : "SELECT name FROM sqlite_master WHERE type = 'table'";
  const names = new Set((await db.prepare(query).all()).map(row => row.name));
  // Nunca escolher silenciosamente uma das bases quando ambas já existem.
  for (const [before, after] of tables) {
    if (names.has(before) && names.has(after)) throw new Error(`Migração Estoq: duas tabelas de ${after} encontradas. Preserve ambas e revise o banco antes de continuar.`);
  }
  for (const [before, after] of tables) {
    if (!names.has(before)) continue;
    await db.prepare(`ALTER TABLE ${before} RENAME TO ${after}`).run();
    names.delete(before);
    names.add(after);
  }
  await db.prepare(`DROP INDEX IF EXISTS ${legacyIndex}`).run();
  if (postgres) {
    // No Postgres, renomear a tabela mantém o nome anterior da chave primária.
    const constraints = await db.prepare("SELECT c.conname AS name FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = current_schema()").all();
    const existing = new Set(constraints.map(row => row.name));
    for (const [before, after] of tables) {
      if (names.has(after) && existing.has(`${before}_pkey`)) await db.prepare(`ALTER TABLE ${after} RENAME CONSTRAINT ${before}_pkey TO ${after}_pkey`).run();
    }
  }
  if (!names.has('estoq_workspace')) return;
  const record = await db.prepare('SELECT revision, payload FROM estoq_workspace WHERE id = 1').first();
  if (!record) return;
  const previous = JSON.parse(record.payload);
  const state = migrateBrandState(previous);
  if (state === previous) return;
  const result = await db.prepare('UPDATE estoq_workspace SET payload = ?, revision = revision + 1 WHERE id = 1 AND revision = ?')
    .bind(JSON.stringify(state), record.revision).run();
  if (result.meta.changes !== 1) throw new Error('A base mudou durante a migração Estoq. Execute novamente antes de iniciar o servidor.');
}

export function legacySessionToken(request) {
  const raw = (request.headers.get('cookie') || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(legacyCookie + '='))?.slice(legacyCookie.length + 1);
  return raw && /^[\w-]{43}$/.test(raw) ? raw : null;
}

export function retireLegacyCookie(request, response, replacement = null) {
  if (!legacySessionToken(request)) return response;
  if (replacement) response.headers.append('Set-Cookie', replacement);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  response.headers.append('Set-Cookie', `${legacyCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  return response;
}
