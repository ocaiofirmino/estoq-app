import { applyCommand } from '../public/domain.js';
import { migrateBrandState } from './migrations/001-estoq.mjs';

export const TABLE_SQL = `CREATE TABLE IF NOT EXISTS estoq_workspace (
  id INTEGER PRIMARY KEY NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT ''
)`;

export async function handleApi(request, db, initialState, mode = 'cloud', actor = null) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  const url = new URL(request.url);
  if (!actor || !['admin','promoter'].includes(actor.role)) return response({ error:'Entre na sua conta para continuar.' },401);
  if (url.pathname !== '/api/state') return response({ error: 'Rota não encontrada.' }, 404);
  if (!['GET','POST'].includes(request.method)) return response({ error: 'Método não permitido.' }, 405);
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return response({ error: 'Origem não permitida.' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return response({ error: 'Envie dados JSON.' }, 415);
  }
  try {
    await db.prepare('INSERT INTO estoq_workspace (id, revision, payload) VALUES (1, 0, ?) ON CONFLICT (id) DO NOTHING').bind(JSON.stringify(initialState)).run();
    const record = await db.prepare('SELECT revision, payload, updated_at FROM estoq_workspace WHERE id = 1').first();
    if (request.method === 'GET') return response({ revision: record.revision, updatedAt: record.updated_at, mode, user:actor, data: JSON.parse(record.payload) });
    const raw = await request.text();
    if (raw.length > 1800000) return response({ error: 'Arquivo muito grande. Limite: 1,8 MB.' }, 413);
    const command = JSON.parse(raw);
    if (!Number.isSafeInteger(command.revision) || command.revision !== record.revision) return response({ error: 'Os dados foram atualizados em outro dispositivo. Recarregue a página antes de salvar.' }, 409);
    const current=JSON.parse(record.payload);
    if(actor.role!=='admin'&&!['saveVisit','deleteVisit'].includes(command.type))
      return response({error:'Apenas Caio pode administrar cadastros e configurações.'},403);
    const now=new Date().toISOString();
    let auditType=command.type;
    if(command.type==='saveVisit'&&command.payload){
      const existing=current.visits.find(v=>v.id===command.payload.id);
      command.payload={...command.payload,createdBy:existing?(existing.createdBy||null):actor.username,
        createdAt:existing?(existing.createdAt||null):now,updatedBy:actor.username,updatedAt:now};
      if(existing?.source)command.payload.source=existing.source;
    }
    if(command.type==='saveProduct'&&command.payload){
      const existing=current.products.find(p=>p.id===command.payload.id);
      const removed=Boolean(existing)&&existing.active!==false&&command.payload.active===false;
      const restored=existing?.active===false&&command.payload.active===true;
      if(removed)auditType='removeProduct';
      if(restored)auditType='reactivateProduct';
      command.payload={...command.payload,createdBy:existing?(existing.createdBy||null):actor.username,
        createdAt:existing?(existing.createdAt||null):now,updatedBy:actor.username,updatedAt:now,
        ...(removed?{removedAt:now,removedBy:actor.username}:restored?{removedAt:null,removedBy:null}:{})};
    }
    let next;
    try{next=migrateBrandState(applyCommand(current,command));}catch(error){return response({error:error.message},400);}
    next.audit=[...(current.audit||[]),{type:auditType,entityId:command.payload?.id||null,
      username:actor.username,name:actor.name,at:now}].slice(-200);
    const payload = JSON.stringify(next);
    if (payload.length > 1800000) return response({ error: 'Base acima do limite desta versão. Exporte um backup.' }, 413);
    const updatedAt = new Date().toISOString();
    const result = await db.prepare('UPDATE estoq_workspace SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?')
      .bind(payload, updatedAt, record.revision).run();
    if (result.meta.changes !== 1) return response({ error: 'Outra alteração acabou de ser salva. Recarregue antes de tentar novamente.' }, 409);
    return response({ revision: record.revision + 1, updatedAt, mode, user:actor, data: next });
  } catch (error) {
    if (error instanceof SyntaxError) return response({ error: 'Arquivo JSON inválido.' }, 400);
    console.error('Estoq database error', error.code||error.name);
    return response({ error: 'Não foi possível acessar os dados. Tente novamente.' }, 500);
  }
}
