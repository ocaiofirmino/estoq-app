import { TABLE_SQL } from './api.mjs';
import { migrateBrandSchema } from './migrations/001-estoq.mjs';

export const AUTH_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS estoq_sessions (
    token_hash TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL,
    auth_version TEXT NOT NULL, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS estoq_sessions_expiry ON estoq_sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS estoq_login_limits (
    account_key TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL,
    window_start BIGINT NOT NULL
  )`,
];

export function sqliteAdapter(sqlite) {
  return { engine:'sqlite', prepare(sql) {
    const statement=sqlite.prepare(sql);
    const bound=(values=[])=>({
      bind:(...values)=>bound(values),
      first:async()=>statement.get(...values),
      all:async()=>statement.all(...values),
      run:async()=>({meta:{changes:Number(statement.run(...values).changes)}}),
    });
    return bound();
  }};
}

export function postgresAdapter(query) {
  return { engine:'postgres', prepare(sql) {
    let parameter=0;
    const text=sql.replace(/\?/g,()=>`$${++parameter}`);
    const bound=(values=[])=>({
      bind:(...values)=>bound(values),
      first:async()=>(await query(text,values)).rows[0],
      all:async()=>(await query(text,values)).rows,
      run:async()=>({meta:{changes:Number((await query(text,values)).rowCount)}}),
    });
    return bound();
  }};
}

let cloudDb;
export async function getCloudDatabase() {
  if(cloudDb)return cloudDb;
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL não configurada.');
  // A conexão só é criada em execução; o build não depende do banco configurado.
  const {neon}=await import('@neondatabase/serverless');
  const sql=neon(process.env.DATABASE_URL);
  cloudDb=postgresAdapter((text,values)=>sql.query(text,values,{fullResults:true}));
  return cloudDb;
}

export async function initializeDatabase(db,initialState) {
  await migrateBrandSchema(db);
  for(const sql of [TABLE_SQL,...AUTH_SCHEMA])await db.prepare(sql).run();
  await db.prepare('INSERT INTO estoq_workspace (id,revision,payload) VALUES (1,0,?) ON CONFLICT (id) DO NOTHING')
    .bind(JSON.stringify(initialState)).run();
}
