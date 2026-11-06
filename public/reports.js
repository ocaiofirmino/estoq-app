import {brandLogo} from './brand.js';
import {selectReport,recommendation} from './domain.js';
import {productReportTable} from './report-products.js';
import {e,fmt,date,monthName,today,icon,button,heading,empty} from './ui.js';

function metric(label,value,foot,ico,unit='',progress=null){
  return `<div class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon(ico)}</span></div><div class="metric-value">${fmt(value)}${unit?`<span class="value-unit">${unit}</span>`:''}</div><div class="metric-foot">${foot}</div>${progress!==null?`<div class="mini-progress"><span style="width:${Math.max(0,Math.min(100,progress))}%"></span></div>`:''}</div>`;
}

function monthlyMetrics(s){
  return `<div class="metrics">${metric('Estoque contado no mês',s.counted?s.totalStock:null,`${fmt(s.counted)} produtos × lojas conferidos no mês`,'stock','un.')}${metric('Lojas visitadas no mês',s.visitedStores,`${fmt(s.stores.length-s.visitedStores)} lojas não conferidas no mês`,'stores',`/ ${s.stores.length}`,s.stores.length?s.visitedStores/s.stores.length*100:0)}${metric('Saídas estimadas',s.outgoing,'Reduções observadas nas contagens do mês','chart','un.')}${metric('Possível reposição',s.possibleRestock,'Aumentos observados nas contagens do mês','plus','un.')}</div>`;
}

function notice(s){
  if(!s.counted)return '';
  if(!s.comparable)return `<div class="notice">${icon('info')}<div><strong>A primeira contagem é o dia zero.</strong> As próximas contagens mostrarão automaticamente possíveis reposições quando o estoque aumentar e saídas estimadas quando diminuir.</div></div>`;
  return `<div class="notice">${icon('info')}<div><strong>Leitura automática das contagens.</strong> As variações do mês usam a contagem anterior como referência, inclusive de outro mês. São estimativas de saída e reposição, sem somar o estoque anterior ao mês selecionado.${s.unknown?` ${s.unknown} contagens ainda são referências iniciais.`:''}</div></div>`;
}

function monthlyReport(data,s,filters,title,isTotal){
  const products=new Map(s.products.map(p=>[p.id,p]));
  const summary=[...new Set(s.products.map(p=>p.laboratory))].map(l=>{
    const balances=s.balances.filter(b=>products.get(b.productId)?.laboratory===l);
    const known=s.movements.filter(m=>products.get(m.productId)?.laboratory===l&&m.comparable);
    return `<tr><td>${e(l)}</td><td class="right">${fmt(balances.length?balances.reduce((n,b)=>n+b.stock,0):null)}</td><td class="right">${fmt(known.length?known.reduce((n,m)=>n+m.possibleRestock,0):null)}</td><td class="right">${fmt(known.length?known.reduce((n,m)=>n+m.outgoing,0):null)}</td><td class="right">${balances.filter(b=>b.stock===0).length}</td></tr>`;
  }).join('');
  const recs=new Map();
  for(const b of s.balances){
    const r=recommendation(b,data.settings.targetDays);
    if(r?.units>0){if(!recs.has(b.productId))recs.set(b.productId,[]);recs.get(b.productId).push({b,r});}
  }
  const planning=recs.size?`<details class="report-planning"><summary>Planejamento de compra · meta de ${data.settings.targetDays} dias</summary><div class="table-wrap"><table class="table"><thead><tr><th>PRODUTO</th><th>PFs E QUANTIDADES SUGERIDAS</th><th class="right">TOTAL</th></tr></thead><tbody>${[...recs].map(([id,list])=>`<tr><td class="product-title">${e(products.get(id)?.name)}</td><td class="product-locations">${list.map(({b,r})=>`<span class="store-pill">${e(b.storeId)} <strong>${fmt(r.units)} un.</strong></span>`).join(' ')}</td><td class="right">${fmt(list.reduce((n,x)=>n+x.r.units,0))} un.</td></tr>`).join('')}</tbody></table></div><p class="tiny muted">Sugestão baseada na redução da última contagem do mês, sem considerar prazo de entrega ou estoque de segurança. Uma possível reposição no último intervalo deixa essa sugestão em aberto.</p></details>`:'';
  const countedStores=new Set(s.balances.map(b=>b.storeId));
  const uncounted=s.stores.filter(store=>!countedStores.has(store.id));
  const uncountedList=uncounted.length?`<details class="report-uncounted"><summary>Demais lojas não conferidas no mês selecionado (${uncounted.length})</summary><p class="report-text">${uncounted.map(store=>`${e(store.id)} · ${e(store.name)}`).join(' / ')}</p></details><p class="print-uncounted">Lojas não conferidas neste mês: ${uncounted.map(store=>e(store.id)).join(', ')}.</p>`:'';
  return `<article class="report-sheet" data-report-month="${e(s.month)}"><div class="report-title"><div><div class="report-label">ESTOQUE E DISTRIBUIÇÃO DA LINHA</div><h2>${e(isTotal?monthName(s.month):title)}</h2><p>${e(isTotal?title:monthName(s.month))} · ${e(filters.laboratory||'Todos os laboratórios')}</p></div><div class="report-wordmark">${brandLogo()}</div></div><p class="report-text">${s.visitedStores} de ${s.stores.length} lojas visitadas em ${e(monthName(s.month))}. ${s.counted?`A última contagem de cada produto e loja realizada neste mês soma <strong>${fmt(s.totalStock)} unidades</strong>.`:'Nenhuma contagem registrada neste mês para os filtros selecionados.'} Contagens de outros meses não entram neste estoque.</p>${monthlyMetrics(s)}${uncountedList}${notice(s)}${s.counted?`<section class="report-section"><h3>Produtos e disponibilidade por PF</h3><p class="report-text">Cada PF mostra a última quantidade conferida neste mês. As PFs com zero ficam agrupadas em “Sem estoque”. As demais PFs não foram conferidas para aquele produto no mês selecionado.</p>${productReportTable(s,{e,fmt,date})}</section><section class="report-section"><h3>Resumo por laboratório</h3><div class="table-wrap"><table class="table"><thead><tr><th>LABORATÓRIO</th><th class="right">ESTOQUE CONTADO</th><th class="right">POSSÍVEL REPOSIÇÃO</th><th class="right">SAÍDA ESTIMADA</th><th class="right">PONTOS SEM ESTOQUE</th></tr></thead><tbody>${summary}</tbody></table></div></section>${planning}`:''}<section class="report-section"><h3>Como ler</h3><p class="report-text">A primeira contagem de cada produto e loja é o dia zero. Nas próximas, o aumento indica possível reposição e a redução indica saída estimada. Essas variações usam o histórico anterior como referência e são atribuídas ao mês da nova contagem. Reposições e saídas no mesmo intervalo podem se compensar. Produtos e lojas não conferidos no mês permanecem sem contagem; zero significa ausência de estoque confirmada.</p></section><div class="report-foot"><span>Estoq · Gerado em ${date(today())}</span><span>Fonte: contagens registradas nas visitas do mês</span></div></article>`;
}

function totalReport(report,title,filters){
  return `<article class="report-sheet report-total"><div class="report-title"><div><div class="report-label">ACUMULADO DOS MESES</div><h2>Total por mês</h2><p>${e(title)} · ${e(filters.laboratory||'Todos os laboratórios')}</p></div><div class="report-wordmark">${brandLogo()}</div></div><p class="report-text">Soma das contagens mensais, com cada mês separado abaixo, do mais antigo ao mais recente. Em cada mês, vale a última contagem de cada produto e loja realizada naquele mês.</p><div class="metrics">${metric('Soma das contagens mensais',report.counted?report.totalStock:null,`${report.periods.length} meses na seleção`,'stock','un.')}${metric('Conferências de lojas por mês',report.storeMonths,`${report.visitedStores} lojas distintas; uma loja pode aparecer em vários meses`,'stores')}${metric('Saídas estimadas',report.outgoing,'Soma das reduções observadas em cada mês','chart','un.')}${metric('Possível reposição',report.possibleRestock,'Soma dos aumentos observados em cada mês','plus','un.')}</div><div class="table-wrap"><table class="table report-month-summary"><thead><tr><th>MÊS</th><th class="right">LOJAS VISITADAS</th><th class="right">ESTOQUE CONTADO</th><th class="right">SAÍDA ESTIMADA</th><th class="right">POSSÍVEL REPOSIÇÃO</th></tr></thead><tbody>${report.periods.map(s=>`<tr><td>${e(monthName(s.month))}</td><td class="right">${s.visitedStores} / ${s.stores.length}</td><td class="right">${fmt(s.counted?s.totalStock:null)}</td><td class="right">${fmt(s.outgoing)}</td><td class="right">${fmt(s.possibleRestock)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total acumulado</th><td class="right">${fmt(report.storeMonths)}</td><td class="right">${fmt(report.counted?report.totalStock:null)}</td><td class="right">${fmt(report.outgoing)}</td><td class="right">${fmt(report.possibleRestock)}</td></tr></tfoot></table></div><p class="report-text">A soma reúne conferências de meses diferentes e pode incluir a mesma loja em cada mês. Ela representa o trabalho registrado ao longo dos meses, sem indicar o estoque disponível hoje.</p></article>`;
}

export function reportsPage(data,filters,{filterBar}){
  const report=selectReport(data,filters);
  const title=filters.storeId?data.stores.find(s=>s.id===filters.storeId)?.name||filters.storeId:'Toda a rede';
  return heading('Relatórios','Visitas e contagens separadas por mês.',button('Exportar Excel','export-excel','secondary','down')+button('Exportar CSV','export-csv','secondary','down')+button('Imprimir / PDF','print','primary','print'),'RELATÓRIO PARA COMPRADORES')+filterBar()+(!filters.month?totalReport(report,title,filters):'')+report.periods.map(s=>monthlyReport(data,s,filters,title,!filters.month)).join('')+(!report.periods.length?empty('Nenhuma visita na seleção','Os meses aparecerão aqui quando houver visitas para os filtros selecionados.'):'');
}
