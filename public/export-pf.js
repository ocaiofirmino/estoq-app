import {selectData,orderedVisits} from './domain.js';

const asDate=value=>new Date(value+'T00:00:00Z');

export function pfReportSheets(data,filters={},generatedAt=new Date()){
  const selected=selectData(data,filters);
  const stores=[...selected.stores].sort((a,b)=>a.id.localeCompare(b.id,'pt-BR',{numeric:true}));
  const products=selected.products;
  const visitsByStore=new Map(stores.map(store=>[store.id,[]]));
  // As datas das visitas são mantidas mesmo quando nenhum produto do laboratório foi conferido.
  for(const visit of orderedVisits(data)){
    if(visitsByStore.has(visit.storeId)&&(!filters.month||visit.date.startsWith(filters.month)))
      visitsByStore.get(visit.storeId).push(visit);
  }
  const productLabels=products.map(p=>`${p.name}${p.active===false?' (fora do catálogo)':''}\nCód. ${p.code} · ${p.laboratory}`);
  const headerHeight=Math.min(409,Math.max(45,...productLabels.map(label=>label.split('\n').reduce((lines,text)=>lines+Math.ceil(text.length/28),0)*15+12)));
  const sheet={name:'PF por produto',widths:[24,...products.map(()=>32)],rows:[],sectionRows:[],headerRows:[],headerHeight,freezeRows:0,autoFilter:false};
  for(const store of stores){
    if(sheet.rows.length)sheet.rows.push([]);
    sheet.sectionRows.push(sheet.rows.length);
    sheet.rows.push([`${store.id} · ${store.name}`]);
    sheet.headerRows.push(sheet.rows.length);
    sheet.rows.push(['Data da visita',...productLabels]);
    const visits=visitsByStore.get(store.id);
    if(!visits.length)sheet.rows.push([filters.month?'Sem visitas no mês selecionado':'Sem visitas registradas',...products.map(()=>null)]);
    for(const visit of visits){
      const quantities=new Map(visit.items.map(item=>[item.productId,item.stock]));
      // Cada linha representa somente aquela visita, sem herdar contagens anteriores.
      sheet.rows.push([asDate(visit.date),...products.map(p=>quantities.get(p.id)??null)]);
    }
  }
  if(!sheet.rows.length)sheet.rows.push(['PF por produto'],['Nenhuma loja na seleção.']);
  const context={name:'Contexto',widths:[30,85],rows:[
    ['Informação','Descrição'],
    ['Relatório','PF por produto · histórico de visitas'],
    ['Gerado em',generatedAt.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})],
    ['Período',filters.month||'Todo o histórico de visitas, sem somar quantidades entre datas.'],
    ['Loja',filters.storeId||'Todas as lojas'],
    ['Laboratório',filters.laboratory||'Todos os laboratórios'],
    ['Lojas na seleção',stores.length],
    ['Visitas na seleção',[...visitsByStore.values()].reduce((total,visits)=>total+visits.length,0)],
    ['Como ler','Cada bloco começa pela PF. A linha seguinte identifica os produtos e cada linha abaixo mostra as quantidades de uma visita, com a data na primeira coluna.'],
    ['Campos em branco','Produto não conferido naquela visita. Uma quantidade de outra data não é reaproveitada.'],
    ['Estoque zero','O produto foi conferido e não havia unidades. Zero é diferente de campo em branco.'],
    ['Sem visitas','As lojas sem visitas no período continuam listadas, sem presumir estoque zero.'],
    ['Filtro de laboratório','As datas das visitas da loja são mantidas; produtos de outros laboratórios ficam fora das colunas.'],
  ]};
  return [sheet,context];
}
