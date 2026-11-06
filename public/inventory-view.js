import {orderedVisits,visitProducts,visitSnapshot} from './domain.js';
import {normalize} from './ui.js';

export function visitRows(data,selected){
 return [...selected.visits].reverse().map(visit=>{
  const lines=selected.movements.filter(m=>m.visitId===visit.id),known=lines.filter(m=>m.comparable);
  const products=visitProducts(data,visit).filter(p=>selected.products.some(x=>x.id===p.id));
  const counted=products.filter(p=>visit.items.some(i=>i.productId===p.id&&i.stock!=null)).length;
  const store=data.stores.find(s=>s.id===visit.storeId);
  return {visit,store,counted,total:products.length,outgoing:known.length?known.reduce((n,m)=>n+m.outgoing,0):null,restock:known.length?known.reduce((n,m)=>n+m.possibleRestock,0):null,
   status:counted<products.length?'Parcial':known.length?'Completa':'Dia zero',color:counted<products.length?'orange':known.length?'green':'purple'};
 });
}
export function storeRows(data,selected,{query='',status='all',sort='name'}={}){
 const visits=orderedVisits(data),queryText=normalize(query);
 const end=selected.endDate||'9999-12-31';
 const rows=selected.stores.map(store=>{
  const balances=selected.balances.filter(b=>b.storeId===store.id);
  const last=visits.filter(v=>v.storeId===store.id&&v.date<=end).at(-1);
  const inPeriod=selected.visits.some(v=>v.storeId===store.id);
  const counted=last?selected.products.filter(p=>last.items.some(i=>i.productId===p.id&&i.stock!=null)).length:0;
  const total=selected.products.filter(p=>p.active!==false||last?.items.some(i=>i.productId===p.id)).length;
  const code=!last?'unvisited':!inPeriod?'outside':counted<total?'partial':'complete';
  return {store,last,counted,total,stock:balances.length?balances.reduce((n,b)=>n+b.stock,0):null,code,
   label:({unvisited:'Sem contagem',outside:'Sem visita no período',partial:'Contagem parcial',complete:'Conferida'})[code]};
 }).filter(r=>(status==='all'||r.code===status)&&normalize(r.store.id+' '+r.store.name+' '+(r.store.city||'')).includes(queryText));
 return rows.sort((a,b)=>sort==='stock'?(b.stock??-1)-(a.stock??-1):sort==='recent'?(b.last?.date||'').localeCompare(a.last?.date||'')||a.store.id.localeCompare(b.store.id):a.store.id.localeCompare(b.store.id,'pt-BR',{numeric:true}));
}
export function pendingChecks(data,selected){
 return selected.stores.flatMap(store=>{
  const last=selected.visits.filter(v=>v.storeId===store.id).at(-1);
  const products=visitProducts(data,last).filter(p=>selected.products.some(x=>x.id===p.id));
  const missing=products.filter(p=>!last?.items.some(i=>i.productId===p.id&&i.stock!=null));
  return !last||missing.length?[{store,visit:last,missing,kind:last?'partial':'unvisited'}]:[];
 });
}
export function zeroRows(data,selected){
 return selected.balances.filter(b=>b.stock===0).map(balance=>({balance,product:data.products.find(p=>p.id===balance.productId),store:data.stores.find(s=>s.id===balance.storeId)}));
}
export function zeroStores(data,selected){
 const groups=new Map();
 for(const row of zeroRows(data,selected)){
  if(!groups.has(row.store.id))groups.set(row.store.id,{store:row.store,rows:[]});
  groups.get(row.store.id).rows.push(row);
 }
 return [...groups.values()].sort((a,b)=>a.store.id.localeCompare(b.store.id,'pt-BR',{numeric:true}));
}
export function productLocations(data,id,selected){
 const balances=selected.balances.filter(b=>b.productId===id);
 return {balances,total:balances.length?balances.reduce((n,b)=>n+b.stock,0):null,unknown:selected.stores.length-balances.length,
  history:selected.movements.filter(m=>m.productId===id).slice().reverse()};
}
export function visitDetails(data,visit,laboratory=''){
 return visitSnapshot(data,visit.storeId,visit.id,laboratory);
}
