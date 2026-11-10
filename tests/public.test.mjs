import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { accounts } from '../lib/accounts.mjs';
import { verifyPassword } from '../lib/auth.mjs';
import { initializeDatabase, sqliteAdapter } from '../lib/database.mjs';
import { handleRequest } from '../lib/router.mjs';
import { selectData, validateState } from '../public/domain.js';
import { testPassword } from './helpers/auth-env.mjs';

// Exemplos sintéticos: nenhuma planilha, credencial ou contagem real.
const example=()=>({schemaVersion:1,products:[{id:'p-test',code:'TEST',name:'Produto de teste',laboratory:'Teste',active:true}],
  stores:[{id:'PF01',code:'PF01',name:'Loja de teste',official:true}],visits:[],settings:{targetDays:30},audit:[]});
async function context(){
  const sqlite=new DatabaseSync(':memory:'),db=sqliteAdapter(sqlite);
  await initializeDatabase(db,example());
  return {sqlite,db,call:(path,{body,cookie}={})=>handleRequest(new Request('https://estoq.test'+path,{
    method:body?'POST':'GET',headers:{origin:'https://estoq.test','Content-Type':'application/json',...(cookie?{cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{})}),db,example(),'test')};
}

test('os metadados públicos dos perfis não incluem hashes ou senhas',async()=>{
  assert(Object.values(accounts).every(account=>!('passwordHash' in account)&&!('password' in account)));
  assert.equal(await verifyPassword('invalid',undefined),false);
});

test('ausência de configuração privada impede autenticação',async()=>{
  const original=process.env.CAIO_PASSWORD_HASH,c=await context();
  try{delete process.env.CAIO_PASSWORD_HASH;assert.equal((await c.call('/api/auth/login',{body:{username:'caio',password:testPassword}})).status,503);}
  finally{process.env.CAIO_PASSWORD_HASH=original;c.sqlite.close();}
});

test('credenciais sintéticas autenticam os dois papéis e os dados exigem sessão',async()=>{
  const c=await context();
  try{
    assert.equal((await c.call('/api/state')).status,401);
    for(const [username,role] of [['caio','admin'],['laylah','promoter']]){
      const response=await c.call('/api/auth/login',{body:{username,password:testPassword}});
      assert.equal(response.status,200);assert.equal((await response.json()).user.role,role);
      const cookie=response.headers.get('set-cookie').split(';')[0];
      const state=await c.call('/api/state',{cookie});assert.equal(state.status,200);
      assert.equal((await state.json()).data.products[0].name,'Produto de teste');
    }
  }finally{c.sqlite.close();}
});

async function sessionCookie(c,username){
  const response=await c.call('/api/auth/login',{body:{username,password:testPassword}});
  assert.equal(response.status,200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('Laylah pode criar, corrigir e excluir visitas próprias e do administrador',async()=>{
  const c=await context();
  try{
    const cookies={caio:await sessionCookie(c,'caio'),laylah:await sessionCookie(c,'laylah')};
    let revision=0;
    for(const username of ['laylah','caio']){
      const visit={id:'visit-'+username,storeId:'PF01',date:'2026-11-01',notes:'Contagem inicial',items:[{productId:'p-test',stock:5}]};
      const created=await c.call('/api/state',{cookie:cookies[username],body:{revision,type:'saveVisit',payload:visit}});
      assert.equal(created.status,200);
      const initial=await created.json(),original=initial.data.visits.find(v=>v.id===visit.id);
      revision=initial.revision;
      assert.equal(original.createdBy,username);
      const corrected=await c.call('/api/state',{cookie:cookies.laylah,body:{revision,type:'saveVisit',payload:{...visit,notes:'Corrigida por Laylah',items:[{productId:'p-test',stock:3}],createdBy:'invalid',createdAt:'invalid'}}});
      assert.equal(corrected.status,200);
      const updated=await corrected.json(),saved=updated.data.visits.find(v=>v.id===visit.id);
      revision=updated.revision;
      assert.equal(saved.items[0].stock,3);
      assert.equal(saved.notes,'Corrigida por Laylah');
      assert.equal(saved.createdBy,username);
      assert.equal(saved.createdAt,original.createdAt);
      assert.equal(saved.updatedBy,'laylah');
      assert.equal(updated.data.audit.at(-1).username,'laylah');
      assert.equal(updated.data.audit.at(-1).type,'saveVisit');
      const deleted=await c.call('/api/state',{cookie:cookies.laylah,body:{revision,type:'deleteVisit',payload:{id:visit.id}}});
      assert.equal(deleted.status,200);
      const final=await deleted.json();revision=final.revision;
      assert.equal(final.data.visits.length,0);
      assert.equal(final.data.audit.at(-1).username,'laylah');
      assert.equal(final.data.audit.at(-1).type,'deleteVisit');
      assert.equal(final.data.audit.at(-1).entityId,visit.id);
    }
  }finally{c.sqlite.close();}
});

test('as permissões de Laylah continuam limitadas às visitas',async()=>{
  const c=await context();
  try{
    const cookie=await sessionCookie(c,'laylah');
    const before=await (await c.call('/api/state',{cookie})).json();
    for(const [type,payload] of [
      ['saveStore',{...example().stores[0],name:'Nome alterado'}],
      ['saveProduct',{...example().products[0],active:false}],
      ['settings',{targetDays:60}],
      ['restore',{...example(),products:[]}],
    ]){
      const response=await c.call('/api/state',{cookie,body:{revision:before.revision,type,payload}});
      assert.equal(response.status,403,type);
    }
    assert.deepEqual(await (await c.call('/api/state',{cookie})).json(),before);
    const adminCookie=await sessionCookie(c,'caio');
    const response=await c.call('/api/state',{cookie:adminCookie,body:{revision:before.revision,type:'saveStore',payload:{...example().stores[0],name:'Nome alterado'}}});
    assert.equal(response.status,200);
    assert.equal((await response.json()).data.stores[0].name,'Nome alterado');
  }finally{c.sqlite.close();}
});

test('correções e exclusões de Laylah exigem sessão e respeitam a revisão atual',async()=>{
  const c=await context();
  try{
    const cookie=await sessionCookie(c,'laylah');
    const visit={id:'visit-test',storeId:'PF01',date:'2026-11-01',notes:'',items:[{productId:'p-test',stock:5}]};
    const created=await c.call('/api/state',{cookie,body:{revision:0,type:'saveVisit',payload:visit}});
    assert.equal(created.status,200);
    const before=await created.json();
    for(const type of ['saveVisit','deleteVisit']){
      const payload=type==='saveVisit'?{...visit,items:[{productId:'p-test',stock:1}]}:{id:visit.id};
      assert.equal((await c.call('/api/state',{cookie,body:{revision:0,type,payload}})).status,409);
      assert.equal((await c.call('/api/state',{body:{revision:before.revision,type,payload}})).status,401);
    }
    assert.deepEqual(await (await c.call('/api/state',{cookie})).json(),before);
  }finally{c.sqlite.close();}
});

test('inicializar novamente preserva o estado já gravado no banco',async()=>{
  const c=await context();
  try{
    const before=c.sqlite.prepare('SELECT revision,payload FROM estoq_workspace WHERE id=1').get();
    await initializeDatabase(c.db,{...example(),products:[]});
    assert.deepEqual(c.sqlite.prepare('SELECT revision,payload FROM estoq_workspace WHERE id=1').get(),before);
  }finally{c.sqlite.close();}
});

test('variações de contagem somam reposições e saídas, incluindo estoque zero',()=>{
  const data=example();
  data.visits=[10,15,12].map((stock,index)=>({id:'test-'+index,storeId:'PF01',date:'2026-11-0'+(index+1),notes:'',items:[{productId:'p-test',stock}]}));
  validateState(data);
  const selected=selectData(data,{month:'2026-11'});
  assert.equal(selected.totalStock,12);assert.equal(selected.possibleRestock,5);assert.equal(selected.outgoing,3);
  data.visits.push({id:'test-zero',storeId:'PF01',date:'2026-11-04',notes:'',items:[{productId:'p-test',stock:0}]});
  const zero=selectData(data,{month:'2026-11'});
  assert.equal(zero.totalStock,0);assert.equal(zero.outgoing,15);
});
