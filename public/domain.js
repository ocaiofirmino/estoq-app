export function orderedVisits(data) {
  return [...data.visits].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

// Somente as contagens físicas participam da leitura automática.
// Campos de movimentação dos backups antigos são preservados, sem entrar nestes cálculos.
export function derive(data,endDate='9999-12-31') {
  const balances=new Map(),movements=[];
  for(const visit of orderedVisits(data)) {
    if(visit.date>endDate)continue;
    for(const item of visit.items) {
      const key=`${visit.storeId}:${item.productId}`,previous=balances.get(key);
      const hasCount=item.stock!==null&&item.stock!==undefined;
      const previousStock=previous?.stock??null;
      const comparable=hasCount&&previousStock!==null;
      const delta=comparable?item.stock-previousStock:null;
      const outgoing=comparable?Math.max(0,-delta):null;
      const possibleRestock=comparable?Math.max(0,delta):null;
      const days=comparable?Math.round((Date.parse(visit.date)-Date.parse(previous.countDate))/86400000):null;
      // Uma alta de estoque pode esconder saídas no intervalo: não sugere ritmo de venda.
      const rate=comparable&&days>0&&delta<=0?outgoing/days:null;
      const status=!hasCount?'uncounted':!comparable?'baseline':delta>0?'restock':delta<0?'outgoing':'unchanged';
      movements.push({productId:item.productId,stock:hasCount?item.stock:null,visitId:visit.id,
        storeId:visit.storeId,date:visit.date,previousStock,previousDate:previous?.countDate??null,
        comparable,delta,outgoing,possibleRestock,days,rate,status});
      if(hasCount)balances.set(key,{storeId:visit.storeId,productId:item.productId,
        stock:item.stock,countDate:visit.date,lastVisitId:visit.id,rate,lastStatus:status});
    }
  }
  return {balances:[...balances.values()],movements};
}

export function selectData(data,{month='',storeId='',laboratory=''}={}) {
  const end=month?`${month}-31`:'9999-12-31';
  const derived=derive(data,end);
  const stores=data.stores.filter(s=>!storeId||s.id===storeId);
  const products=data.products.filter(p=>!laboratory||p.laboratory===laboratory);
  const storeIds=new Set(stores.map(s=>s.id)),productIds=new Set(products.map(p=>p.id));
  const matches=line=>storeIds.has(line.storeId)&&productIds.has(line.productId);
  const balances=derived.balances.filter(matches);
  const movements=derived.movements.filter(m=>matches(m)&&(!month||m.date.startsWith(month)));
  const visits=orderedVisits(data).filter(v=>storeIds.has(v.storeId)&&(!month||v.date.startsWith(month))&&v.items.some(i=>productIds.has(i.productId)));
  const known=movements.filter(m=>m.comparable);
  return {endDate:end,stores,products,balances,movements,visits,
    totalStock:balances.reduce((n,b)=>n+b.stock,0),
    outgoing:known.length?known.reduce((n,m)=>n+m.outgoing,0):null,
    possibleRestock:known.length?known.reduce((n,m)=>n+m.possibleRestock,0):null,
    zeroStock:balances.filter(b=>b.stock===0).length,counted:balances.length,
    visitedStores:new Set(visits.filter(v=>v.items.some(i=>productIds.has(i.productId)&&i.stock!==null&&i.stock!==undefined)).map(v=>v.storeId)).size,
    comparable:known.length,unknown:movements.filter(m=>m.stock!==null&&!m.comparable).length};
}

export function recommendation(balance,targetDays=30) {
  if(balance.stock===null||balance.rate===null||balance.rate<=0)return null;
  return {coverage:balance.stock/balance.rate,units:Math.max(0,Math.ceil(balance.rate*targetDays-balance.stock))};
}

export function visitProducts(data,visit=null) {
  const recorded=new Set(visit?.items.map(i=>i.productId)||[]);
  return data.products.filter(p=>p.active!==false||recorded.has(p.id));
}

export function visitSnapshot(data,storeId,visitId,laboratory='') {
  const visit=data.visits.find(v=>v.id===visitId&&v.storeId===storeId);
  if(!visit)throw new Error('Escolha uma visita desta loja.');
  const movements=derive(data,visit.date).movements.filter(m=>m.visitId===visit.id);
  const byProduct=new Map(movements.map(m=>[m.productId,m]));
  const rows=visitProducts(data,visit).filter(p=>!laboratory||p.laboratory===laboratory).map(product=>{
    const m=byProduct.get(product.id);
    return {product,stock:m?.stock??null,oldStock:m?.previousStock??null,
      previousDate:m?.previousDate??null,outgoing:m?.outgoing??null,
      possibleRestock:m?.possibleRestock??null,delta:m?.delta??null,
      status:m?.status||'uncounted'};
  });
  const counted=rows.filter(r=>r.stock!==null),known=rows.filter(r=>r.outgoing!==null);
  return {kind:'day',visit,rows,counted:counted.length,unknown:rows.length-counted.length,
    totalStock:counted.length?counted.reduce((n,r)=>n+r.stock,0):null,
    outgoing:known.length?known.reduce((n,r)=>n+r.outgoing,0):null,
    possibleRestock:known.length?known.reduce((n,r)=>n+r.possibleRestock,0):null,
    comparable:known.length,baseline:rows.filter(r=>r.status==='baseline').length};
}

export function comparisonView(data,selection) {
  if(selection.mode==='day'||!selection.fromId||selection.fromId===selection.toId)
    return visitSnapshot(data,selection.storeId,selection.toId,selection.laboratory);
  return {kind:'range',...compareVisits(data,selection.storeId,selection.fromId,selection.toId,selection.laboratory)};
}

export function compareVisits(data,storeId,fromId,toId,laboratory='') {
  const from=data.visits.find(v=>v.id===fromId),to=data.visits.find(v=>v.id===toId);
  if(!from||!to||from.storeId!==storeId||to.storeId!==storeId)throw new Error('Escolha duas visitas da mesma loja.');
  if(from.date>=to.date)throw new Error('A visita inicial precisa ser anterior à visita final.');
  const interval=derive(data,to.date).movements.filter(m=>m.storeId===storeId&&m.date>from.date&&m.date<=to.date);
  const days=Math.round((Date.parse(to.date)-Date.parse(from.date))/86400000);
  const historical=new Set([...from.items,...to.items].map(i=>i.productId));
  const rows=data.products.filter(p=>(p.active!==false||historical.has(p.id))&&(!laboratory||p.laboratory===laboratory)).map(product=>{
    const oldStock=from.items.find(i=>i.productId===product.id)?.stock??null;
    const newStock=to.items.find(i=>i.productId===product.id)?.stock??null;
    const comparable=oldStock!==null&&newStock!==null;
    const movements=interval.filter(m=>m.productId===product.id&&m.comparable);
    const outgoing=comparable?movements.reduce((n,m)=>n+m.outgoing,0):null;
    const possibleRestock=comparable?movements.reduce((n,m)=>n+m.possibleRestock,0):null;
    const delta=comparable?newStock-oldStock:null;
    return {product,oldStock,newStock,outgoing,possibleRestock,delta,days,
      daily:comparable&&possibleRestock===0?outgoing/days:null,
      status:!comparable?'missing':delta>0?'restock':delta<0?'outgoing':'unchanged'};
  });
  const comparable=rows.filter(r=>r.outgoing!==null);
  return {from,to,days,rows,
    oldStock:rows.some(r=>r.oldStock!==null)?rows.reduce((n,r)=>n+(r.oldStock??0),0):null,
    newStock:rows.some(r=>r.newStock!==null)?rows.reduce((n,r)=>n+(r.newStock??0),0):null,
    outgoing:comparable.length?comparable.reduce((n,r)=>n+r.outgoing,0):null,
    possibleRestock:comparable.length?comparable.reduce((n,r)=>n+r.possibleRestock,0):null,
    comparable:comparable.length,missing:rows.filter(r=>r.status==='missing').length};
}

export function groupProductStores(selected) {
  const stores=new Map(selected.stores.map(s=>[s.id,s]));
  const byProduct=new Map(),movesByProduct=new Map();
  for(const b of selected.balances){if(!byProduct.has(b.productId))byProduct.set(b.productId,[]);byProduct.get(b.productId).push(b);}
  for(const m of selected.movements){if(!movesByProduct.has(m.productId))movesByProduct.set(m.productId,[]);movesByProduct.get(m.productId).push(m);}
  return selected.products.filter(p=>p.active!==false||byProduct.has(p.id)).map(product=>{
    const balances=byProduct.get(product.id)||[],movements=movesByProduct.get(product.id)||[];
    const known=movements.filter(m=>m.comparable);
    const locations=balances.map(b=>({store:stores.get(b.storeId),stock:b.stock,countDate:b.countDate}))
      .sort((a,b)=>a.store.id.localeCompare(b.store.id,'pt-BR',{numeric:true}));
    return {product,stock:locations.length?locations.reduce((n,b)=>n+b.stock,0):null,
      withStock:locations.filter(b=>b.stock>0),withoutStock:locations.filter(b=>b.stock===0),
      counted:locations.length,storeCount:selected.stores.length,
      outgoing:known.length?known.reduce((n,m)=>n+m.outgoing,0):null,
      possibleRestock:known.length?known.reduce((n,m)=>n+m.possibleRestock,0):null};
  });
}

export function validateState(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.products) || !Array.isArray(data.stores) || !Array.isArray(data.visits))
    throw new Error('Backup incompatível. Use um arquivo exportado pelo Estoq.');
  const unique = (list, label) => {
    const ids = new Set();
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || ids.has(item.id)) throw new Error(`${label}: identificador inválido ou duplicado.`);
      ids.add(item.id);
    }
    return ids;
  };
  const stores = unique(data.stores, 'Loja'), products = unique(data.products, 'Produto');
  unique(data.visits, 'Visita');
  for (const store of data.stores) {
    if (typeof store.name !== 'string' || !store.name.trim() || store.name.length > 180 || typeof store.official !== 'boolean') throw new Error('Cadastro de loja inválido.');
    for (const field of ['city','buyer','notes']) if (store[field] !== undefined && (typeof store[field] !== 'string' || store[field].length > 5000)) throw new Error('Dados da loja inválidos.');
  }
  for (const product of data.products) {
    if (typeof product.name !== 'string' || !product.name.trim() || product.name.length > 250 || typeof product.laboratory !== 'string' || !product.laboratory.trim() || typeof product.code !== 'string') throw new Error('Cadastro de produto inválido.');
    if(product.active!==undefined&&typeof product.active!=='boolean')throw new Error('Situação do produto inválida.');
    for(const [field,max] of [['category',100],['unit',30]])if(product[field]!==undefined&&(typeof product[field]!=='string'||product[field].length>max))throw new Error('Categoria ou unidade do produto inválida.');
  }
  const dates = new Set();
  for (const visit of data.visits) {
    if (!stores.has(visit.storeId) || typeof visit.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(visit.date) || !Number.isFinite(Date.parse(visit.date)) || new Date(visit.date).toISOString().slice(0,10) !== visit.date) throw new Error('Loja ou data da visita inválida.');
    const dateKey = `${visit.storeId}:${visit.date}`;
    if (dates.has(dateKey)) throw new Error('Já existe uma visita nesta loja e data. Abra o histórico para editá-la.');
    dates.add(dateKey);
    if (typeof visit.notes !== 'string' || visit.notes.length > 5000 || !Array.isArray(visit.items) || visit.items.length === 0) throw new Error('Preencha pelo menos um produto na visita.');
    const seen = new Set();
    for (const item of visit.items) {
      if (!products.has(item.productId) || seen.has(item.productId)) throw new Error('Produto inválido ou duplicado na visita.');
      seen.add(item.productId);
      if(item.stock!==null&&(!Number.isSafeInteger(item.stock)||item.stock<0||item.stock>10000000))throw new Error('Use quantidades inteiras, sem valores negativos.');
      // Leitura de backups antigos: manter os campos históricos, mesmo com a função manual desativada.
      for(const key of ['incoming','outgoing','adjustment']){
        const value=item[key];if(value===null||value===undefined)continue;
        if(!Number.isSafeInteger(value)||Math.abs(value)>10000000||(key!=='adjustment'&&value<0))throw new Error('Movimentação histórica inválida.');
      }
      if(item.stock===null&&!item.incoming&&!item.adjustment&&item.outgoing==null)throw new Error('Produto sem contagem.');
    }
  }
  if (!Number.isInteger(data.settings?.targetDays) || data.settings.targetDays < 1 || data.settings.targetDays > 365) throw new Error('Meta de cobertura deve estar entre 1 e 365 dias.');
  return data;
}

export function applyCommand(state, command) {
  const next = structuredClone(state), { type, payload } = command;
  if (type === 'saveVisit') {
    const existing = next.visits.findIndex(v => v.id === payload.id);
    const previous=existing>=0?next.visits[existing]:null;
    for(const item of payload.items){
      if(next.products.find(p=>p.id===item.productId)?.active===false&&!previous?.items.some(i=>i.productId===item.productId))
        throw new Error('Um produto foi removido do catálogo. Atualize a página antes de registrar a contagem.');
    }
    const legacy=previous?.legacyMovements||
      (previous?.items||payload.items).filter(i=>i.incoming||i.adjustment||i.outgoing)
        .map(i=>({productId:i.productId,incoming:i.incoming??0,outgoing:i.outgoing??null,adjustment:i.adjustment??0}));
    const saved={...payload,countingMode:'automatic',
      items:payload.items.filter(i=>i.stock!==null).map(i=>({productId:i.productId,stock:i.stock}))};
    if(legacy.length)saved.legacyMovements=structuredClone(legacy);
    if (existing >= 0) next.visits[existing] = saved;
    else next.visits.push(saved);
  } else if (type === 'deleteVisit') {
    if (!next.visits.some(v => v.id === payload.id)) throw new Error('Visita não encontrada.');
    next.visits = next.visits.filter(v => v.id !== payload.id);
  } else if (type === 'saveStore') {
    const existing = next.stores.findIndex(s => s.id === payload.id);
    // Manter o campo legado nos backups, sem separar lojas dos totais da rede.
    const saved = { ...payload, official: true };
    if (existing >= 0) next.stores[existing] = saved;
    else next.stores.push(saved);
  } else if (type === 'saveProduct') {
    const existing = next.products.findIndex(p => p.id === payload.id);
    const previous=existing>=0?next.products[existing]:null;
    const saved={...previous,...payload,active:payload.active??(previous?.active!==false)};
    if (existing >= 0) next.products[existing] = saved;
    else next.products.push(saved);
  } else if (type === 'settings') {
    next.settings = { ...next.settings, ...payload };
  } else if (type === 'restore') {
    return validateState(payload);
  } else throw new Error('Operação desconhecida.');
  return validateState(next);
}
