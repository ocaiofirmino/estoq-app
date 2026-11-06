import {visitProducts,derive} from './domain.js';
import './storage-migration.js';
const key=user=>`estoq-draft-v1:${user}`;
export function newDraft(visit){return {version:1,visit:structuredClone(visit),cursor:0,step:'setup',view:'focus',savedAt:''};}
export function catalogFor(data,state){return visitProducts(data,data.visits.find(v=>v.id===state.visit.id)||null);}
export function countProgress(data,state){const catalog=catalogFor(data,state);return {total:catalog.length,counted:catalog.filter(p=>state.visit.items.some(i=>i.productId===p.id&&Number.isSafeInteger(i.stock)&&i.stock>=0)).length};}
export function setQuantity(state,productId,value){
 if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>10000000))throw new Error('Informe uma quantidade inteira entre 0 e 10.000.000.');
 const next=structuredClone(state);next.visit.items=next.visit.items.filter(i=>i.productId!==productId);
 if(value!==null)next.visit.items.push({productId,stock:value});
 return next;
}
export function previousCount(data,visit,productId){return derive({...data,visits:data.visits.filter(v=>v.id!==visit.id&&v.date<visit.date)},visit.date).balances.find(b=>b.storeId===visit.storeId&&b.productId===productId)||null;}
export function listDrafts(storage,user){
 try{return globalThis.estoqStorageMigration.drafts(storage,user).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''));}catch{return [];}
}
export function readDraft(storage,user,id){const list=listDrafts(storage,user);return (id?list.find(s=>s.visit.id===id):list[0])||null;}
export function saveDraft(storage,user,state){try{const list=listDrafts(storage,user).filter(s=>s.visit.id!==state.visit.id);storage.setItem(key(user),JSON.stringify([{...state,savedAt:new Date().toISOString()},...list]));return true;}catch{return false;}}
export function clearDraft(storage,user,id){try{const list=listDrafts(storage,user).filter(s=>s.visit.id!==id);if(list.length)storage.setItem(key(user),JSON.stringify(list));else storage.removeItem(key(user));}catch{/* O registro salvo no servidor não depende do armazenamento do navegador. */}}
export function visitPayload(state){const {visit}=state;return {...visit,countingMode:'automatic',items:visit.items.filter(i=>i.stock!=null).map(i=>({productId:i.productId,stock:i.stock}))};}
