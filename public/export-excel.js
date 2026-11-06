import {selectData,recommendation,comparisonView,groupProductStores} from './domain.js';

const sum=(list,key)=>list.reduce((n,item)=>n+(item[key]??0),0);
const asDate=value=>value?new Date(value+'T00:00:00Z'):null;
function observed(lines,key){const known=lines.filter(m=>m.comparable);return known.length?sum(known,key):null;}
function indexBy(list,key){const map=new Map();for(const item of list){const k=key(item);if(!map.has(k))map.set(k,[]);map.get(k).push(item);}return map;}
const reading={baseline:'Dia zero',restock:'Possível reposição',outgoing:'Saída estimada',unchanged:'Sem alteração',uncounted:'Não conferido',missing:'Não conferido'};

export function dashboardSheets(data,filters={},generatedAt=new Date()){
  const s=selectData(data,filters),products=new Map(s.products.map(p=>[p.id,p])),stores=new Map(s.stores.map(store=>[store.id,store]));
  const balances=new Map(s.balances.map(b=>[`${b.storeId}:${b.productId}`,b]));
  const byStore=indexBy(s.movements,m=>m.storeId),byPair=indexBy(s.movements,m=>`${m.storeId}:${m.productId}`),byVisit=indexBy(s.movements,m=>m.visitId),byLab=indexBy(s.movements,m=>products.get(m.productId).laboratory);
  const scope=filters.storeId?stores.get(filters.storeId)?.name||filters.storeId:'Toda a rede';
  const overview={name:'Dashboards',widths:[39,42,100],rows:[
    ['Indicador','Valor','Contexto'],['Sistema','Estoq','Leitura automática baseada somente nas contagens físicas.'],
    ['Gerado em',generatedAt.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),'Horário de Brasília.'],
    ['Período',filters.month||'Todo o histórico','Visitas e variações observadas no período.'],
    ['Loja',scope,'Todas as lojas fazem parte da rede. O filtro permite consultar uma loja individualmente.'],
    ['Laboratório',filters.laboratory||'Todos os laboratórios','Filtro aplicado a todas as abas.'],
    ['Estoque contado',s.counted?s.totalStock:null,'Última contagem física até o fim do período. As PFs podem ter sido conferidas em datas diferentes.'],
    ['Saídas estimadas',s.outgoing,'Soma das reduções entre contagens. Em branco quando não há contagem anterior.'],
    ['Possível reposição',s.possibleRestock,'Soma dos aumentos entre contagens. Não confirma quantidades efetivamente recebidas.'],
    ['Lojas na seleção',s.stores.length,'Total de lojas abrangidas pelo filtro.'],['Lojas visitadas',s.visitedStores,'Lojas com contagem registrada no período.'],
    ['Lojas sem visita no período',s.stores.length-s.visitedStores,'Não significa estoque igual a zero.'],['Visitas no período',s.visits.length,'Visitas que incluem produtos selecionados.'],
    ['Produtos cadastrados',s.products.length,'Quantidade de produtos na seleção.'],['Combinações produto e loja conferidas',s.counted,'Combinações com contagem conhecida até o fim do período.'],
    ['Pontos sem estoque',s.zeroStock,'Produto e PF cuja última contagem é zero.'],
    ['Dia zero','A primeira contagem','Serve como referência, sem estimar reposição ou saída.'],['Campos vazios','Não conferido ou sem referência','Zero continua sendo uma quantidade conhecida.'],
    ['Como ler as variações','Aumento = possível reposição; redução = saída estimada','Reposições e saídas no mesmo intervalo podem se compensar. As estimativas não comprovam compras ou vendas.'],
  ]};
  const laboratories={name:'Laboratórios',rows:[['Laboratório','Estoque contado','Possível reposição','Saída estimada','Pontos sem estoque','Combinações conferidas']]};
  for(const lab of new Set(s.products.map(p=>p.laboratory))){const b=s.balances.filter(b=>products.get(b.productId).laboratory===lab),m=byLab.get(lab)||[];laboratories.rows.push([lab,b.length?sum(b,'stock'):null,observed(m,'possibleRestock'),observed(m,'outgoing'),b.filter(b=>b.stock===0).length,b.length]);}
  const grouped={name:'Produtos por PF',widths:[48,18,17,20,90,75,18,18,20,22],rows:[['Produto','Laboratório','Código','Estoque total','PFs com estoque e quantidades','PFs sem estoque','PFs com estoque','PFs conferidas','Saída estimada','Possível reposição']]};
  for(const row of groupProductStores(s))grouped.rows.push([row.product.name,row.product.laboratory,row.product.code,row.stock,row.withStock.map(b=>`${b.store.id}: ${b.stock} un.`).join(' / '),row.withoutStock.map(b=>b.store.id).join(' / '),row.withStock.length,row.counted,row.outgoing,row.possibleRestock]);
  const storeSheet={name:'Lojas',rows:[['Código da loja','Loja','Cidade','Última visita no período','Última contagem conhecida','Produtos conferidos','Produtos cadastrados','Estoque contado','Possível reposição','Saída estimada','Pontos sem estoque','Situação']]};
  for(const store of s.stores){const b=s.balances.filter(b=>b.storeId===store.id),m=byStore.get(store.id)||[],v=s.visits.filter(v=>v.storeId===store.id);const last=b.map(b=>b.countDate).sort().at(-1);storeSheet.rows.push([store.id,store.name,store.city,asDate(v.at(-1)?.date),asDate(last),b.length,s.products.length,b.length?sum(b,'stock'):null,observed(m,'possibleRestock'),observed(m,'outgoing'),b.filter(b=>b.stock===0).length,!b.length?'Sem contagem':!v.length?'Sem visita no período':b.length<s.products.length?'Contagem parcial':'Conferida']);}
  const stockSheet={name:'Estoque por produto',widths:[16,24,18,16,48,20,19,23,20,22,22,23,21,26],rows:[['Código da loja','Loja','Laboratório','Código do produto','Produto','Última contagem','Estoque contado','Possível reposição no período','Saída estimada no período','Ritmo observado (un./dia)','Cobertura estimada (dias)','Compra sugerida (un.)','Meta de cobertura (dias)','Última leitura']]};
  for(const store of s.stores)for(const p of s.products){const key=`${store.id}:${p.id}`,b=balances.get(key),m=byPair.get(key)||[],r=b?recommendation(b,data.settings.targetDays):null;stockSheet.rows.push([store.id,store.name,p.laboratory,p.code,p.name,asDate(b?.countDate),b?.stock??null,observed(m,'possibleRestock'),observed(m,'outgoing'),b?.rate??null,r?.coverage??null,r?.units??null,data.settings.targetDays,b?reading[b.lastStatus]:'Não conferido']);}
  const movements={name:'Movimentações',widths:[18,16,24,18,16,48,20,19,20,22,20,18,23,26],rows:[['Data da visita','Código da loja','Loja','Laboratório','Código do produto','Produto','Contagem anterior em','Estoque anterior','Contagem atual','Possível reposição','Saída estimada','Variação','Intervalo (dias)','Leitura automática']]};
  for(const m of s.movements){const p=products.get(m.productId);movements.rows.push([asDate(m.date),m.storeId,stores.get(m.storeId).name,p.laboratory,p.code,p.name,asDate(m.previousDate),m.previousStock,m.stock,m.possibleRestock,m.outgoing,m.delta,m.days,reading[m.status]]);}
  const visits={name:'Visitas',widths:[18,16,24,22,20,23,20,65,22,22],rows:[['Data','Código da loja','Loja','Produtos conferidos','Estoque da visita','Possível reposição','Saída estimada','Observações','Registrada por','Atualizada por']]};
  for(const v of s.visits){const m=byVisit.get(v.id)||[],counts=m.filter(m=>m.stock!==null);visits.rows.push([asDate(v.date),v.storeId,stores.get(v.storeId).name,counts.length,counts.length?sum(counts,'stock'):null,observed(m,'possibleRestock'),observed(m,'outgoing'),v.notes,v.createdBy||'Importada da planilha',v.updatedBy||null]);}
  return [overview,laboratories,grouped,storeSheet,stockSheet,movements,visits];
}

export function comparisonSheets(data,selection){
  const c=comparisonView(data,selection),store=data.stores.find(s=>s.id===selection.storeId);
  if(c.kind==='day')return [
    {name:'Visita do dia',widths:[48,18,16,20,20,20,20,23,20,26],rows:[['Produto','Laboratório','Código','Data da visita','Contagem do dia','Contagem anterior','Data anterior','Possível reposição','Saída estimada','Leitura automática'],...c.rows.map(r=>[r.product.name,r.product.laboratory,r.product.code,asDate(c.visit.date),r.stock,r.oldStock,asDate(r.previousDate),r.possibleRestock,r.outgoing,reading[r.status]])]},
    {name:'Contexto',widths:[35,45,100],rows:[['Indicador','Valor','Observação'],['Loja',store.name,store.id],['Data',asDate(c.visit.date),'Consulta de uma única visita; não exige uma segunda data.'],['Laboratório',selection.laboratory||'Todos','Filtro aplicado à consulta.'],['Estoque do dia',c.totalStock,'Soma das contagens informadas nesta visita.'],['Produtos conferidos',c.counted,'Zero é uma contagem conhecida.'],['Produtos não conferidos',c.unknown,'São mantidos em branco, sem presumir estoque zero.'],['Saída estimada',c.outgoing,'Só aparece quando existe contagem anterior do mesmo produto.'],['Possível reposição',c.possibleRestock,'Só aparece quando existe contagem anterior do mesmo produto.'],['Dia zero','Referência inicial','Na primeira contagem não se estimam saídas nem reposições.']]},
  ];
  return [
    {name:'Comparativo',widths:[48,18,16,20,19,23,20,20,19,23,26],rows:[['Produto','Laboratório','Código','Visita inicial','Estoque anterior','Possível reposição','Saída estimada','Visita final','Estoque atual','Variação do estoque','Leitura'],...c.rows.map(r=>[r.product.name,r.product.laboratory,r.product.code,asDate(c.from.date),r.oldStock,r.possibleRestock,r.outgoing,asDate(c.to.date),r.newStock,r.delta,r.possibleRestock>0&&r.outgoing>0?'Reposição e saída':reading[r.status]])]},
    {name:'Contexto',widths:[35,45,100],rows:[['Indicador','Valor','Observação'],['Loja',store.name,store.id],['Laboratório',selection.laboratory||'Todos','Filtro aplicado ao comparativo.'],['Visita inicial',asDate(c.from.date),'Contagem física da visita selecionada.'],['Visita final',asDate(c.to.date),'Contagem física da visita selecionada.'],['Intervalo (dias)',c.days,'As altas e quedas de contagens intermediárias são somadas.'],['Saídas estimadas',c.outgoing,'Soma das reduções dos produtos com contagem nas duas visitas escolhidas.'],['Possível reposição',c.possibleRestock,'Soma dos aumentos dos produtos com contagem nas duas visitas escolhidas.'],['Produtos comparados',c.comparable,'Produtos contados nas duas visitas.'],['Sem ambas as contagens',c.missing,'Os valores permanecem em branco.'],['Leitura','Mais = possível reposição; menos = saída estimada','São variações de estoque, não confirmação de compras ou vendas.'],['Campos em branco','Sem contagem ou sem referência','Zero é uma quantidade conhecida.']]},
  ];
}
