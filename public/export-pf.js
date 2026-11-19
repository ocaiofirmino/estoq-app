import {orderedVisits} from './domain.js';
import {reportPeriod} from './report-period.js';

const asDate=value=>value?new Date(value+'T00:00:00Z'):null;
function wrappedLines(text,width){
  const limit=Math.max(1,Math.floor(width));
  let lines=1,used=0;
  for(const word of text.split(/\s+/)){
    if(used&&used+1+word.length>limit){lines++;used=0;}
    if(used)used++;
    used+=word.length;
    while(used>limit){lines++;used-=limit;}
  }
  return lines;
}

export function pfReportSheets(data,filters={},generatedAt=new Date()){
  const period=reportPeriod(filters.period??(filters.month?{type:'month',month:filters.month}:{type:'all'}));
  const stores=data.stores.filter(store=>!filters.storeId||store.id===filters.storeId)
    .sort((a,b)=>a.id.localeCompare(b.id,'pt-BR',{numeric:true}));
  const products=data.products.filter(product=>!filters.laboratory||product.laboratory===filters.laboratory);
  const visitsByStore=new Map(stores.map(store=>[store.id,[]]));
  let firstVisitDate='',lastVisitDate='';
  // As datas das visitas são mantidas mesmo quando nenhum produto do laboratório foi conferido.
  for(const visit of orderedVisits(data)){
    if(!visitsByStore.has(visit.storeId)||(period.startDate&&visit.date<period.startDate)||(period.endDate&&visit.date>period.endDate))continue;
    visitsByStore.get(visit.storeId).push(visit);
    if(!firstVisitDate)firstVisitDate=visit.date;
    lastVisitDate=visit.date;
  }
  const productLabels=products.map(p=>`${p.name}${p.active===false?' (fora do catálogo)':''}\nCód. ${p.code} · ${p.laboratory}`);
  const productWidths=products.map(p=>Math.min(19.5,Math.max(14,Math.ceil(p.name.length/4)+10)));
  const headerHeight=Math.min(409,Math.max(57,...productLabels.map((label,i)=>label.split('\n').reduce((lines,text)=>lines+wrappedLines(text,productWidths[i]),0)*13.5+3)));
  const sheet={name:'PF por produto',widths:[10,...productWidths],rows:[],sectionRows:[],headerRows:[],headerHeight,compact:true,rowHeights:{},wrapRows:[],freezeRows:0,autoFilter:false};
  for(const store of stores){
    if(sheet.rows.length)sheet.rows.push([]);
    sheet.sectionRows.push(sheet.rows.length);
    sheet.rows.push([`${store.id} · ${store.name}`]);
    sheet.headerRows.push(sheet.rows.length);
    sheet.rows.push(['Data da visita',...productLabels]);
    const visits=visitsByStore.get(store.id);
    if(!visits.length){
      const message=period.type==='all'?'Sem visitas registradas':period.type==='month'?'Sem visitas no mês selecionado':'Sem visitas no período selecionado';
      sheet.wrapRows.push(sheet.rows.length);
      sheet.rowHeights[sheet.rows.length]=wrappedLines(message,11)*15;
      sheet.rows.push([message,...products.map(()=>null)]);
    }
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
    ['Período',period.label],
    ['Data inicial',asDate(period.startDate||firstVisitDate)],
    ['Data final',asDate(period.endDate||lastVisitDate)],
    ['Loja',filters.storeId||'Todas as lojas'],
    ['Laboratório',filters.laboratory||'Todos os laboratórios'],
    ['Lojas na seleção',stores.length],
    ['Visitas na seleção',[...visitsByStore.values()].reduce((total,visits)=>total+visits.length,0)],
    ['Como ler','Cada bloco começa pela PF. A linha seguinte identifica os produtos e cada linha abaixo mostra as quantidades de uma visita, com a data na primeira coluna.'],
    ['Campos em branco','Produto não conferido naquela visita. Uma quantidade de outra data não é reaproveitada.'],
    ['Estoque zero','O produto foi conferido e não havia unidades. Zero é diferente de campo em branco.'],
    ['Dia zero','A primeira contagem conhecida de cada produto em uma PF é sua referência inicial. A opção Todo o histórico inclui todas as visitas desde o início, sem somar quantidades de datas diferentes.'],
    ['Sem visitas','As lojas sem visitas no período continuam listadas, sem presumir estoque zero.'],
    ['Filtro de laboratório','As datas das visitas da loja são mantidas; produtos de outros laboratórios ficam fora das colunas.'],
  ]};
  return [sheet,context];
}
