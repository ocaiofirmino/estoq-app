import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { planSpreadsheetImport } from '../lib/spreadsheet-import.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function importLocalSpreadsheet(imported, { dataDir = resolve(root, 'data'),
  initialPath = resolve(root, 'lib/initial-data.json'), sourcePath, apply = false } = {}) {
  const databasePath = resolve(dataDir, 'estoq.sqlite');
  const sqlite = new DatabaseSync(databasePath, { readOnly: !apply });
  let staged;
  try {
    sqlite.exec('PRAGMA busy_timeout=5000');
    const record = sqlite.prepare('SELECT revision,payload FROM estoq_workspace WHERE id=1').get();
    if (!record) throw new Error('Base local sem registros. Inicie o Estoq antes de importar.');
    const initialText = readFileSync(initialPath, 'utf8'), at = new Date().toISOString();
    const live = planSpreadsheetImport(JSON.parse(record.payload), imported, at);
    const seed = planSpreadsheetImport(JSON.parse(initialText), imported, at);
    const report = { applied: false, revisionBefore: record.revision, source: imported.source,
      database: live.summary, initial: seed.summary };
    if (!apply || (!live.changed && !seed.changed)) return report;
    const backups = resolve(dataDir, 'backups');
    mkdirSync(backups, { recursive: true });
    const destination = mkdtempSync(resolve(backups, `estoq-antes-importacao-${at.replace(/[-:.]/g, '')}-`));
    report.backup = destination;
    await backup(sqlite, resolve(destination, 'estoq.sqlite'));
    writeFileSync(resolve(destination, 'workspace-before.json'), record.payload + '\n', { mode: 0o600 });
    copyFileSync(initialPath, resolve(destination, 'initial-data-before.json'));
    if (sourcePath) {
      const archive = resolve(dataDir, 'imports', imported.source.sha256.slice(0, 12) + '-' + basename(sourcePath));
      mkdirSync(dirname(archive), { recursive: true });
      copyFileSync(sourcePath, archive);
      report.archivedSpreadsheet = archive;
    }
    staged = `${initialPath}.${process.pid}.tmp`;
    if (seed.changed) writeFileSync(staged, JSON.stringify(seed.next, null, 2) + '\n');
    const payload = JSON.stringify(live.next);
    if (payload.length > 1800000) throw new Error('A importação ultrapassa o limite de 1,8 MB da base.');
    sqlite.exec('BEGIN IMMEDIATE');
    let seedWritten = false;
    try {
      const latest = sqlite.prepare('SELECT revision,payload FROM estoq_workspace WHERE id=1').get();
      if (latest.revision !== record.revision || latest.payload !== record.payload || readFileSync(initialPath, 'utf8') !== initialText)
        throw new Error('A base mudou durante a importação. Execute novamente para preservar as alterações.');
      if (live.changed) sqlite.prepare('UPDATE estoq_workspace SET payload=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?')
        .run(payload, at, record.revision);
      if (seed.changed) { renameSync(staged, initialPath); seedWritten = true; }
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      if (seedWritten) writeFileSync(initialPath, initialText);
      throw error;
    }
    report.applied = true;
    report.revisionAfter = record.revision + Number(live.changed);
    writeFileSync(resolve(destination, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally {
    sqlite.close();
    if (staged) rmSync(staged, { force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), apply = args.includes('--apply');
    const paths = args.filter(arg => arg !== '--apply');
    if (paths.length !== 1) throw new Error('Uso: npm run import:spreadsheet -- "/caminho/planilha.xlsx" [--apply]');
    if (process.env.DATABASE_URL) throw new Error('Este importador atualiza somente a base SQLite local. DATABASE_URL está configurada.');
    const sourcePath = resolve(paths[0]);
    const temporary = mkdtempSync(resolve(tmpdir(), 'estoq-planilha-'));
    let imported;
    try {
      const output = resolve(temporary, 'converted.json');
      await promisify(execFile)('python3', [resolve(root, 'scripts/import_spreadsheet.py'), sourcePath, output],
        { encoding: 'utf8' });
      imported = JSON.parse(readFileSync(output, 'utf8'));
    } finally { rmSync(temporary, { recursive: true, force: true }); }
    const report = await importLocalSpreadsheet(imported, {
      sourcePath, apply, dataDir: resolve(process.env.ESTOQ_DATA_DIR || resolve(root, 'data')) });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Importação Estoq:', error.message);
    process.exitCode = 1;
  }
}
