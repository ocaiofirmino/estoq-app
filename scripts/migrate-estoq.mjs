import { DatabaseSync, backup } from 'node:sqlite';
import { access, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase, sqliteAdapter } from '../lib/database.mjs';
import { LEGACY_LOCAL_DATABASE } from '../lib/migrations/001-estoq.mjs';
import initial from '../lib/initial-data.json' with { type: 'json' };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(process.env.ESTOQ_DATA_DIR || resolve(root, 'data'));
const before = resolve(folder, LEGACY_LOCAL_DATABASE);
const after = resolve(folder, 'estoq.sqlite');
const exists = async path => { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const oldExists = await exists(before), newExists = await exists(after);
if (oldExists && newExists) throw new Error('Duas bases locais encontradas. Preserve ambas e revise antes de migrar para Estoq.');
if (!oldExists && !newExists) throw new Error('Nenhuma base local encontrada. Inicie Estoq para criar a primeira base.');
const sqlite = new DatabaseSync(oldExists ? before : after);
try {
  sqlite.exec('PRAGMA busy_timeout=5000;');
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const destination = resolve(folder, 'backups', `estoq-antes-migracao-${stamp}.sqlite`);
  await mkdir(dirname(destination), { recursive: true });
  await backup(sqlite, destination);
  sqlite.exec('BEGIN IMMEDIATE');
  try { await initializeDatabase(sqliteAdapter(sqlite), initial); sqlite.exec('COMMIT'); }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  const checkpoint = sqlite.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  if (checkpoint.busy) throw new Error('Encerre o servidor anterior antes de renomear o banco para Estoq.');
  console.log(`Estoq: dados, sessões e limites de login migrados. Backup: ${destination}`);
} finally { sqlite.close(); }
if (oldExists) await rename(before, after);
console.log(`Banco Estoq: ${after}`);
