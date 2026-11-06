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
