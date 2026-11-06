import {e,fmt,date,monthName,today,icon,button,heading,badge,empty,normalize,reading} from './ui.js';
import {overviewPage,storesPage,productsPage,laboratoriesPage,movementsPage,expandableVisits,storeDetail,productDetail} from './screens.js';
import {countingPage} from './counting.js';
import {newDraft,catalogFor,countProgress,setQuantity,previousCount,readDraft,listDrafts,saveDraft,clearDraft,visitPayload} from './visit-draft.js';
import { selectData, validateState, comparisonView, visitProducts } from './domain.js';
import { comparisonPage } from './comparison.js';
import { reportsPage } from './reports.js';
import { reportCsvRows } from './report-csv.js';
import { dashboardSheets, reportSheets, comparisonSheets } from './export-excel.js';
import { createXlsx, XLSX_MIME } from './xlsx.js';

const labs={Duprat:'#6a9b78',Pearson:'#a3b69a',Provets:'#d4b57c',Syntec:'#a2b8b3'};
const main=document.querySelector('#content'),modal=document.querySelector('#modal');
const pages={overview:'Início',stores:'Lojas',products:'Produtos',laboratories:'Laboratórios',visits:'Visitas',movements:'Movimentações',reports:'Relatórios',compare:'Comparar',settings:'Configurações'};
const adminOnly=new Set(['settings']);
const isAdmin=()=>user?.role==='admin';
let comparison={storeId:'',fromId:'',toId:'',laboratory:'',mode:'day'};
let catalogView='active';
let data,revision,mode,updatedAt,user,filters={month:'',storeId:'',laboratory:''},busy=false,draft=null,dirty=false,toastTimer;
const searches={};
const viewState={dashboardTab:'visits',zeroStoreId:'',storeView:'cards',storeQuery:'',storeStatus:'all',storeSort:'name',productQuery:'',productSort:'name',productPage:1,movementType:'all',movementQuery:''};
let countState=null,countReadonly=false,countSaved=false,countSaving=false,storageWarning=false;
let drawerOrigin=null,countOrigin=null;
const browserStorage=()=>{try{return window.localStorage;}catch{return null;}};
function renderCompare(){main.innerHTML=comparisonPage(data,comparison,{e,fmt,date,icon,heading,button});}
const product=id=>data.products.find(p=>p.id===id), store=id=>data.stores.find(s=>s.id===id);
function toast(message,error=false){const n=document.querySelector('#toast');n.textContent=message;n.className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.className='',5000);}
function connection(state,label){const n=document.querySelector('#connection');n.className=`connection ${state}`;n.innerHTML='<i></i>'+e(label);}
function adopt(result){({data,revision,mode,updatedAt,user}=result);connection('ready',mode==='local'?'Salvo neste computador':'Dados sincronizados');}
async function load(){try{const r=await fetch('/api/state',{cache:'no-store'});if(r.status===401){location.replace('/');return;}const result=await r.json();if(!r.ok)throw new Error(result.error||'Falha ao carregar.');validateState(result.data);adopt(result);filters.month=data.visits.filter(v=>v.date<=today()).map(v=>v.date.slice(0,7)).sort().at(-1)||today().slice(0,7);render();}catch(error){connection('error','Sem conexão');main.innerHTML=`<div class="loading-state"><h1>Não conseguimos abrir os dados</h1><p>${e(error.message)}</p><button class="button primary" data-action="reload">Tentar novamente</button></div>`;}}
async function command(type,payload){
 if(busy)throw new Error('Aguarde a operação anterior.');busy=true;document.querySelectorAll('[data-submit]').forEach(b=>b.disabled=true);
 try{const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload,revision})});const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível salvar.');adopt(result);return result;}
 catch(error){if(error instanceof TypeError){connection('error','Sem conexão');throw new Error('Não foi possível salvar. Seu preenchimento continua aberto; tente novamente quando a conexão voltar.');}throw error;}
 finally{busy=false;document.querySelectorAll('[data-submit]').forEach(b=>b.disabled=false);}
}
const currentPage=()=>{const page=location.hash.slice(1);return pages[page]&&(!adminOnly.has(page)||isAdmin())?page:'overview';};
function filterBar(){
 const isReport=currentPage()==='reports';
 const months=[...new Set([...data.visits.map(v=>v.date.slice(0,7)),today().slice(0,7),filters.month].filter(Boolean))].sort().reverse();
 const monthControl=isReport?`<select id="filter-month" aria-label="Período do relatório"><option value="" ${!filters.month?'selected':''}>Total por mês</option>${months.map(month=>`<option value="${e(month)}" ${filters.month===month?'selected':''}>${e(monthName(month))}</option>`).join('')}</select>`:`<input type="month" id="filter-month" aria-label="Mês do relatório" value="${e(filters.month)}">`;
 return `<div class="filter-bar"><div class="filters"><label class="filter-control">${icon('visits')}${monthControl}</label><label class="filter-control">${icon('stores')}<select id="filter-store" aria-label="Filtrar por loja"><option value="">Toda a rede</option>${data.stores.map(s=>`<option value="${e(s.id)}" ${filters.storeId===s.id?'selected':''}>${e(s.name)}</option>`).join('')}</select></label><label class="filter-control">${icon('products')}<select id="filter-lab" aria-label="Filtrar por laboratório"><option value="">Todos os laboratórios</option>${[...new Set(data.products.map(p=>p.laboratory))].map(l=>`<option ${filters.laboratory===l?'selected':''}>${e(l)}</option>`).join('')}</select></label></div><span class="filter-note">${icon('clock')}${e(isReport&&!filters.month?'Total por mês':monthName(filters.month))}${filters.month?`<button class="text-button" data-action="all-period" aria-label="${isReport?'Mostrar total por mês':'Mostrar todo o histórico'}">${isReport?'Total por mês':'×'}</button>`:''}</span></div>`;
}
function renderOverview(s){main.innerHTML=overviewPage(data,s,{user,filters,tab:viewState.dashboardTab,zeroStoreId:filters.storeId||viewState.zeroStoreId,localDraft:readDraft(browserStorage(),user.username),filterBar});}
function renderStores(s){main.innerHTML=storesPage(data,s,{admin:isAdmin(),filterBar,view:viewState.storeView,query:viewState.storeQuery,status:viewState.storeStatus,sort:viewState.storeSort});}

function renderVisits(s){main.innerHTML=heading('Visitas','Cada contagem fica na história da loja.',button('Registrar visita','new-visit'))+filterBar()+`<section class="surface visit-page">${expandableVisits(data,s)}</section>`;}
function renderProducts(s){main.innerHTML=productsPage(data,s,{admin:isAdmin(),filterBar,query:viewState.productQuery,status:catalogView,sort:viewState.productSort,page:viewState.productPage});}
function renderLaboratories(s){main.innerHTML=laboratoriesPage(data,s,{filterBar});}
function renderMovements(s){main.innerHTML=movementsPage(data,s,{filterBar,type:viewState.movementType,query:viewState.movementQuery});}

function renderReports(){main.innerHTML=reportsPage(data,filters,{filterBar});}
function renderSettings(){main.innerHTML=heading('Configurações','Gerencie sua base e mantenha uma cópia segura do acompanhamento.','','SEU ESPAÇO')+`<div class="settings-grid"><section class="card settings-card"><h2>Backup dos registros</h2><p>Exporte lojas, produtos, visitas e configurações. Guarde uma cópia fora deste computador. A restauração substitui a base atual.</p><div class="settings-row">${button('Baixar backup','backup','primary','down')}${button('Restaurar backup','restore','secondary','stock')}</div><input id="backup-file" class="backup-input" type="file" accept="application/json,.json"></section><section class="card settings-card"><h2>Meta para planejamento de compra</h2><p>A sugestão usa a redução da última contagem e os dias de cobertura. Quando o estoque aumenta, o sistema aponta possível reposição e mantém a sugestão de compra em aberto.</p><form id="settings-form"><label for="target-days">Cobertura desejada (dias)</label><div class="settings-row"><input id="target-days" type="number" min="1" max="365" step="1" value="${data.settings.targetDays}" required><button class="button primary" data-submit type="submit">Salvar meta</button></div></form></section><section class="card settings-card"><h2>Sua planilha já faz parte da base</h2><p><strong>${e(data.imports?.at(-1)?.file||data.source?.file||'Base cadastrada manualmente')}</strong></p><div class="import-facts"><span>${data.stores.length} lojas da rede</span><span>${data.products.length} produtos</span><span>${data.visits.filter(v=>v.source==='spreadsheet').length} visitas importadas</span></div><p>A planilha original foi preservada. A importação usa células preenchidas e recalcula os indicadores sem depender das fórmulas em cache.</p><button class="text-button" data-action="help">Entender os cálculos ${icon('arrow')}</button></section><section class="card settings-card"><h2>${mode==='local'?'Armazenamento neste computador':'Armazenamento sincronizado'}</h2><p>${mode==='local'?'Os registros são salvos em um banco SQLite no computador que executa o sistema. Esta versão local não sincroniza entre dispositivos.':'Os registros ficam no banco do sistema, disponíveis nos dispositivos com acesso autorizado ao mesmo site.'}</p><p>Última gravação: ${updatedAt?e(new Date(updatedAt.endsWith('Z')?updatedAt:updatedAt+'Z').toLocaleString('pt-BR')):'importação inicial'}.</p><div class="notice">${icon('info')}<span>Alterações simultâneas são protegidas: o sistema pede para recarregar antes de sobrescrever uma versão mais recente.</span></div></section></div>`;}
function appendAudit(){
 const labels={saveVisit:'Visita salva ou corrigida',deleteVisit:'Visita excluída',saveStore:'Loja atualizada',saveProduct:'Produto salvo ou atualizado',removeProduct:'Produto removido do catálogo',reactivateProduct:'Produto reativado',settings:'Configuração alterada',restore:'Backup restaurado'};
 const entries=[...(data.audit||[])].reverse().slice(0,15);
 main.insertAdjacentHTML('beforeend',`<section class="card settings-card audit-list"><h2>Últimas alterações</h2><p class="muted">Quem registrou ou ajustou os dados.</p>${entries.length?entries.map(entry=>`<div class="audit-entry"><span class="avatar">${e(entry.name?.slice(0,1)||'?')}</span><div><strong>${e(entry.name)}</strong> · ${e(labels[entry.type]||entry.type)}<br><small>${e(new Date(entry.at).toLocaleString('pt-BR'))}</small></div></div>`).join(''):'<p class="readonly-note" style="margin-top:15px">As próximas visitas e correções aparecerão aqui.</p>'}</section>`);
}
function render(){
 if(!data)return;
 const focused=document.activeElement,focusId=['store-search','product-search','movement-search'].includes(focused?.id)?focused.id:'',selection=focusId?[focused.selectionStart,focused.selectionEnd]:null;
 const page=currentPage(),selected=selectData(data,filters);selected.endDate=filters.month?`${filters.month}-31`:'9999-12-31';
 document.body.dataset.page=page;document.title=`${pages[page]} · Estoq`;
 for(const [id,text] of Object.entries({'page-label':pages[page],'profile-name':user.name,'profile-role':isAdmin()?'Administrador':'Promotora técnica','profile-avatar':user.name.slice(0,1),'user-label':user.name})){
  const element=document.querySelector('#'+id);if(element)element.textContent=text;
 }
 document.querySelector('#navigation').innerHTML=Object.entries(pages).filter(([key])=>!adminOnly.has(key)||isAdmin()).map(([key,title])=>`<a data-section="${key}" class="nav-link ${page===key?'active':''}" href="#${key}" ${page===key?'aria-current="page"':''} aria-label="${title}" title="${title}">${icon(key)}<span class="nav-tooltip">${title}</span><span class="nav-text">${title}</span></a>`).join('')+`<button class="mobile-nav-toggle ${['laboratories','movements','compare','settings'].includes(page)?'active':''}" type="button" data-action="mobile-nav" aria-label="Abrir menu do Estoq" aria-haspopup="dialog" aria-controls="modal" aria-expanded="false"><img class="brand-symbol" src="/favicon.svg" alt="" width="23" height="23"><span>Menu</span></button>`;
 ({overview:renderOverview,stores:renderStores,visits:renderVisits,compare:renderCompare,products:renderProducts,reports:renderReports,laboratories:renderLaboratories,movements:renderMovements,settings:renderSettings}[page])(selected);
 if(page==='settings')appendAudit();applySearch();
 if(focusId){const input=document.querySelector('#'+focusId);if(input){input.focus({preventScroll:true});if(selection&&input.setSelectionRange)input.setSelectionRange(...selection);}}
}
function applySearch(){const input=document.querySelector('[data-search-kind]');if(!input)return;const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const query=norm(searches[input.dataset.searchKind]||'');document.querySelectorAll('tr[data-search]').forEach(row=>row.hidden=!norm(row.dataset.search).includes(query));}
function openModal(content,small=false){modal.classList.remove('count-dialog','count-review-dialog','drawer','menu-sheet');modal.classList.toggle('small-dialog',small);const container=document.querySelector('#modal-content');container.innerHTML=content;container.scrollTop=0;const title=modal.querySelector('h2');if(title){title.id='modal-title';modal.setAttribute('aria-labelledby','modal-title');}if(!modal.open)modal.showModal();}
function openMenu(){
 dirty=false;draft=null;modal.classList.remove('drawer','small-dialog','count-dialog','count-review-dialog');modal.classList.add('menu-sheet');
 const page=currentPage();
 document.querySelector('#modal-content').innerHTML=`<div class="sheet-handle" aria-hidden="true"><span></span></div>${modalHeader('Seu espaço')}<div class="drawer-body"><nav class="mobile-menu" aria-label="Áreas do Estoq">${Object.entries(pages).filter(([key])=>!adminOnly.has(key)||isAdmin()).map(([key,title])=>`<a href="#${key}" data-action="menu-go" data-id="${key}" ${key===page?'aria-current="page"':''}>${icon(key)}<span>${e(title)}</span></a>`).join('')}</nav><div class="sheet-footer">${button('Rascunhos de visitas','drafts','ghost','visits')}</div></div>`;
 const title=modal.querySelector('h2');if(title)title.id='modal-title';modal.setAttribute('aria-labelledby','modal-title');
 if(!modal.open)modal.showModal();document.body.classList.add('menu-open');document.querySelector('.mobile-nav-toggle')?.setAttribute('aria-expanded','true');
}
function closeMenu(afterClose=()=>{}){
 if(modal.dataset.closing)return;
 const finish=()=>{document.body.classList.remove('menu-open');modal.close();modal.classList.remove('menu-sheet');delete modal.dataset.closing;document.querySelector('.mobile-nav-toggle')?.setAttribute('aria-expanded','false');afterClose();};
 if(!modal.open||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof modal.animate!=='function'){finish();return;}
 const appearance=window.getComputedStyle?.(modal);modal.dataset.closing='true';
 const animation=modal.animate([{transform:appearance?.transform&&appearance.transform!=='none'?appearance.transform:'translateY(0)',opacity:appearance?.opacity||1},{transform:'translateY(100%)',opacity:0}],{duration:200,easing:'cubic-bezier(.4,0,1,1)'});
 animation.onfinish=finish;animation.oncancel=finish;
}
function closeModal(){if(busy||countSaving)return;if(modal.classList.contains('menu-sheet')){closeMenu();return;}if(countState){if(!countInputValid())return;if(!persistCount()&&!confirm('O navegador não conseguiu guardar este rascunho. Fechar e descartar o preenchimento?'))return;countState=null;countOrigin=null;countSaved=false;dirty=false;modal.close();render();return;}if(dirty&&!confirm('Descartar o preenchimento desta janela?'))return;modal.close();draft=null;dirty=false;}
const modalHeader=(title,subtitle='')=>`<div class="modal-header"><div><h2>${title}</h2><p>${subtitle}</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="Fechar janela">${icon('close')}</button></div>`;
const errorSlot='<div class="form-error" id="form-error" role="alert"></div>';
function formError(error){const n=document.querySelector('#form-error');if(n){n.textContent=error.message;n.classList.add('visible');n.scrollIntoView({block:'nearest'});}else toast(error.message,true);}
function openVisit(id='',storeId=''){
 const existing=data.visits.find(v=>v.id===id);
 if(!data.stores.length){toast('Cadastre uma loja antes de registrar a visita.',true);return;}
 if(!existing&&!visitProducts(data).length){toast('Adicione um produto ativo antes de registrar a contagem.',true);return;}
 countOrigin=modal.open&&modal.classList.contains('drawer')&&drawerOrigin?{
  ...drawerOrigin,scrollTop:document.querySelector('#modal-content').scrollTop,visitId:id,
  expandedVisits:[...modal.querySelectorAll('.visit-row[open]')].map(row=>row.querySelector('[data-action="edit-visit"]')?.dataset.id),
 }:null;
 const visit=existing||{id:'v-'+crypto.randomUUID(),storeId:storeId||filters.storeId||data.stores[0].id,date:today(),notes:'',items:[],source:'manual'};
 countState=newDraft(visit);countReadonly=Boolean(existing)&&!isAdmin();countSaved=false;countSaving=false;dirty=false;
 if(existing){countState.baseVisit=JSON.stringify(existing);countState.step='review';countState.view='list';}
 persistCount();renderCount();document.querySelector('#modal-content').scrollTop=0;
}
const field=(id,label,value='',attrs='')=>`<div class="form-field"><label for="${id}">${label}</label><input id="${id}" value="${e(value)}" ${attrs}></div>`;
function openStore(id=''){const s=store(id)||{id:'loja-'+crypto.randomUUID(),name:'',city:'',buyer:'',notes:'',official:true};draft=structuredClone(s);dirty=false;openModal(`<form id="store-form">${modalHeader(id?'Editar loja':'Cadastrar loja','Identifique o ponto de venda e os contatos da visita.')}<div class="modal-body"><div class="form-grid">${field('store-code','Código da loja',id?s.id:'',`required maxlength="100" pattern="[A-Za-z0-9_-]+" ${id?'readonly':''}`)}${field('store-name','Nome da loja',s.name,'required maxlength="180"')}${field('store-city','Cidade / região',s.city,'maxlength="180"')}${field('store-buyer','Comprador(a)',s.buyer,'maxlength="180"')}<div class="form-field span-all"><label for="store-notes">Observações</label><textarea id="store-notes" maxlength="5000">${e(s.notes)}</textarea></div></div>${errorSlot}</div><div class="modal-footer"><small>O histórico de visitas é preservado.</small><button class="button primary" type="submit" data-submit>Salvar loja</button></div></form>`,true);}
function openProduct(id=''){const p=product(id)||{id:'p-'+crypto.randomUUID(),name:'',code:'',laboratory:'',active:true};draft=structuredClone(p);dirty=false;openModal(`<form id="product-form">${modalHeader(id?'Editar produto':'Adicionar produto','Cadastre cada apresentação e código separadamente.')}<div class="modal-body"><div class="form-grid">${field('product-name','Produto / apresentação',p.name,'required maxlength="250"')}${field('product-code','Código',p.code,'required maxlength="100"')}${field('product-lab','Laboratório',p.laboratory,'required maxlength="100" list="lab-options"')}${field('product-category','Categoria',p.category||'','maxlength="100"')}${field('product-unit','Unidade de medida',p.unit||'un.','required maxlength="30"')}<datalist id="lab-options">${Object.keys(labs).map(l=>`<option value="${l}">`).join('')}</datalist></div>${errorSlot}</div><div class="modal-footer"><small>Nome, código e laboratório podem ser ajustados sem apagar as contagens.</small><button class="button primary" type="submit" data-submit>Salvar produto</button></div></form>`,true);}
function openHelp(){dirty=false;draft=null;openModal(`${modalHeader('Como funciona','Uma contagem por visita. O restante é automático.')}<div class="modal-body help-content"><h3>Primeira contagem: o dia zero</h3><p>Registre o estoque encontrado em cada produto. Esse será o ponto de partida daquela PF, sem estimar saídas ou reposições.</p><h3>Próximas contagens</h3><ul><li>De 10 para 7 unidades: <strong>saída estimada de 3</strong>.</li><li>De 7 para 12 unidades: <strong>possível reposição de 5</strong>.</li><li>Mesma quantidade: <strong>sem alteração</strong>.</li><li>Branco significa não conferido. Zero significa ausência confirmada.</li></ul><p>O sistema sempre compara com a última contagem conhecida do mesmo produto na mesma PF, mesmo que alguma visita intermediária não o tenha conferido. Não é necessário lançar entradas, saídas ou ajustes manualmente.</p><h3>Nos relatórios</h3><p>Em cada mês, cada produto aparece uma vez, com as PFs e suas quantidades conferidas naquele mês. As demais lojas ficam indicadas como não conferidas. A opção “Total por mês” soma os resultados e mantém os meses separados em ordem cronológica. Excel, CSV e PDF seguem os filtros selecionados.</p><h3>Leitura com contexto</h3><p>São variações de estoque, não confirmação de compras ou vendas. Uma reposição e uma saída dentro do mesmo intervalo podem se compensar. As anotações da visita ajudam a explicar essas situações.</p></div><div class="modal-footer"><small>Os registros anteriores são preservados.</small><button class="button primary" data-action="close-modal">Entendi</button></div>`,true);}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function exportExcel(isComparison=false){
 const sheets=isComparison?comparisonSheets(data,comparison):currentPage()==='reports'?reportSheets(data,filters):dashboardSheets(data,filters);
 const bytes=createXlsx(sheets);
 const filename=isComparison?`Estoq_${comparison.mode==='day'?'Visita':'Comparativo'}_${comparison.storeId}.xlsx`:`Estoq_${currentPage()==='reports'?'Relatorio':'Dashboards'}_${filters.storeId||'rede'}_${filters.month||(currentPage()==='reports'?'total-por-mes':'historico')}.xlsx`;
 download(filename,bytes,XLSX_MIME);toast('Excel exportado com os filtros selecionados.');
}
function csvFile(filename,rows){
 const quote=value=>{let text=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 download(filename,'\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8');toast('Planilha CSV exportada.');
}
function exportCsv(){
 const rows=reportCsvRows(data,filters);
 csvFile(`Estoq_${filters.storeId||'rede'}_${filters.month||(currentPage()==='reports'?'total-por-mes':'historico')}.csv`,rows);
}
function exportComparison(){
 const result=comparisonView(data,comparison);
 if(result.kind==='day'){
  csvFile(`Estoq_visita_${comparison.storeId}_${result.visit.date}.csv`,[['Produto','Código','Laboratório','Data','Contagem do dia','Anterior','Possível reposição','Saída estimada','Leitura'],...result.rows.map(r=>[r.product.name,r.product.code,r.product.laboratory,result.visit.date,r.stock,r.oldStock,r.possibleRestock,r.outgoing,({baseline:'Dia zero',uncounted:'Não conferido',restock:'Possível reposição',outgoing:'Saída estimada',unchanged:'Sem alteração'})[r.status]])]);
 }else csvFile(`Estoq_comparativo_${comparison.storeId}.csv`,[['Produto','Código','Laboratório','Visita inicial','Anterior','Possível reposição','Saída estimada','Visita final','Atual','Variação'],...result.rows.map(r=>[r.product.name,r.product.code,r.product.laboratory,result.from.date,r.oldStock,r.possibleRestock,r.outgoing,result.to.date,r.newStock,r.delta])]);
}
async function action(name,el){try{
 if(await screenAction(name,el))return;
 if(name==='logout'){persistCount();if(dirty&&!confirm('Sair e descartar o preenchimento atual?'))return;const response=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('Não foi possível sair. Tente novamente.');dirty=false;location.replace('/');return;}if(name==='reload')return location.reload();if(name==='new-visit')return openVisit('',el.dataset.id||'');if(name==='edit-visit')return openVisit(el.dataset.id);
 if(name==='new-store')return openStore();if(name==='edit-store')return openStore(el.dataset.id);if(name==='new-product')return openProduct();if(name==='edit-product')return openProduct(el.dataset.id);
 if(name==='remove-product'||name==='reactivate-product'){
  if(!isAdmin())throw new Error('Somente o administrador pode alterar o catálogo.');
  const p=product(el.dataset.id),remove=name==='remove-product';
  if(!p)throw new Error('Produto não encontrado.');
  if(remove&&!confirm(`Remover “${p.name}” do catálogo? Ele deixará de aparecer nas novas contagens. As visitas antigas serão preservadas e você poderá reativá-lo depois.`))return;
  await command('saveProduct',{...p,active:!remove});if(modal.classList.contains('drawer')){modal.close();dirty=false;}render();toast(remove?'Produto removido do catálogo; histórico preservado.':'Produto reativado para novas contagens.');return;
 }
 if(name==='close-modal')return closeModal();if(name==='help')return openHelp();if(name==='all-period'){filters.month='';return render();}if(name==='compare-visit'){const visit=data.visits.find(v=>v.id===el.dataset.id),previous=data.visits.filter(v=>v.storeId===visit.storeId&&v.date<visit.date).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);comparison={storeId:visit.storeId,fromId:previous?.id||'',toId:visit.id,laboratory:'',mode:previous?'range':'day'};location.hash='compare';return render();}if(name==='print')return window.print();if(name==='export-excel')return exportExcel();if(name==='export-comparison-excel')return exportExcel(true);if(name==='export-csv')return exportCsv();if(name==='export-comparison')return exportComparison();
 if(name==='backup'){download(`Estoq_backup_${today()}.json`,JSON.stringify(data,null,2),'application/json');return toast('Backup exportado. Guarde uma cópia em local seguro.');}
 if(name==='restore')return document.querySelector('#backup-file').click();
 if(name==='delete-visit'){if(!confirm('Excluir esta visita? Os indicadores serão recalculados com os registros restantes.'))return;await command('deleteVisit',{id:el.dataset.id});dirty=false;closeModal();render();toast('Visita excluída; indicadores recalculados.');}
}catch(error){formError(error);}}
function selectedData(storeId=''){const selected=selectData(data,storeId?{...filters,storeId}:filters);selected.endDate=filters.month?`${filters.month}-31`:'9999-12-31';return selected;}
function openDrawer(title,content,origin=null){dirty=false;draft=null;drawerOrigin=origin;openModal(`${modalHeader(title)}<div class="drawer-body">${content}</div>`);modal.classList.add('drawer');}
async function returnFromVisit(){
 const origin=countOrigin;
 closeModal();
 if(countState||modal.open||!origin)return;
 await screenAction(origin.action,{dataset:origin});
 const expanded=new Set(origin.expandedVisits);
 modal.querySelectorAll('.visit-row').forEach(row=>row.open=expanded.has(row.querySelector('[data-action="edit-visit"]')?.dataset.id));
 document.querySelector('#modal-content').scrollTop=origin.scrollTop;
 const target=origin.visitId?`[data-action="edit-visit"][data-id="${origin.visitId}"]`:'[data-action="new-visit"]';
 modal.querySelector(target)?.focus({preventScroll:true});
}
function persistCount(){
 if(!countState||countReadonly||countSaved)return true;
 const success=saveDraft(browserStorage(),user.username,countState);
 if(!success&&!storageWarning){storageWarning=true;toast('Não foi possível guardar o rascunho neste navegador. Mantenha a janela aberta até salvar a visita.',true);}
 return success;
}
function renderCount(motion=''){
 if(!countState)return;
 const catalog=catalogFor(data,countState);countState.cursor=Math.min(countState.cursor,Math.max(0,catalog.length-1));
 modal.classList.remove('small-dialog','drawer','menu-sheet');modal.classList.add('count-dialog');
 modal.classList.toggle('count-review-dialog',!countSaved&&(countState.step==='review'||countState.view==='list'));
 document.querySelector('#modal-content').innerHTML=countingPage(data,countState,{readonly:countReadonly,saving:countSaving,saved:countSaved,motion});
 modal.setAttribute('aria-labelledby','count-title');if(countSaving)document.querySelectorAll('#modal button,#modal input,#modal select,#modal textarea').forEach(el=>el.disabled=true);if(!modal.open)modal.showModal();
}
function countInputValid(){
 const inputs=[...document.querySelectorAll('[data-count-product]')];
 for(const input of inputs){if(!input.checkValidity()){input.reportValidity();return false;}}
 return true;
}
function updateCountFeedback(){
 if(!countState)return;const p=catalogFor(data,countState)[countState.cursor];if(!p)return;
 const value=countState.visit.items.find(i=>i.productId===p.id)?.stock??null,previous=previousCount(data,countState.visit,p.id),r=reading(value,previous?.stock);
 const target=document.querySelector('#count-feedback');if(target)target.innerHTML=(value===0?badge('Zero confirmado','red'):'')+badge(r.label,r.color);
 const stats=countProgress(data,countState),bar=document.querySelector('.count-progress [role=progressbar]'),line=document.querySelector('.count-progress p>span');
 if(bar){bar.setAttribute('aria-valuenow',stats.counted);bar.querySelector('i').style.width=`${stats.total?stats.counted/stats.total*100:0}%`;}
 if(line)line.innerHTML=`<strong>${stats.counted}</strong> de ${stats.total} conferidos`;
}
function handleScreenInput(el){
 const queryKeys={'store-search':'storeQuery','product-search':'productQuery','movement-search':'movementQuery'};
 if(queryKeys[el.id]){viewState[queryKeys[el.id]]=el.value;viewState.productPage=1;render();return true;}
 if(el.id==='count-search'){const q=normalize(el.value);document.querySelectorAll('[data-count-find]').forEach(row=>row.hidden=!normalize(row.dataset.countFind).includes(q));return true;}
 if(el.id==='count-notes'&&countState){countState.visit.notes=el.value;persistCount();return true;}
 if(el.dataset.countProduct&&countState){
  if(countReadonly||countSaving)return true;
  try{if(el.validity?.badInput)throw new Error('Informe uma quantidade inteira.');countState=setQuantity(countState,el.dataset.countProduct,el.value===''?null:Number(el.value));el.removeAttribute('aria-invalid');if(el.id==='counter-quantity')el.style.setProperty('--digits',String(el.value||'—').length);document.querySelector('#form-error')?.classList.remove('visible');persistCount();updateCountFeedback();
   const row=el.closest('.count-review-row'),target=row?.querySelector('.count-review-reading');if(target){const stock=countState.visit.items.find(i=>i.productId===el.dataset.countProduct)?.stock??null,previous=previousCount(data,countState.visit,el.dataset.countProduct),r=reading(stock,previous?.stock);target.innerHTML=badge(stock===0?'Zero confirmado':r.label,stock===0?'red':r.color);}
  }catch(error){el.setAttribute('aria-invalid','true');formError(error);}return true;
 }
 return false;
}
function handleScreenChange(el){
 if(el.id==='zero-store'){viewState.zeroStoreId=el.value;render();document.querySelector('#zero-store')?.focus({preventScroll:true});return true;}
 const keys={'store-status':'storeStatus','store-sort':'storeSort','product-sort':'productSort','movement-type':'movementType'};
 if(keys[el.id]){viewState[keys[el.id]]=el.value;viewState.productPage=1;render();return true;}
 if(countState&&el.id==='count-store'){
  if(countReadonly)return true;
  if(countState.visit.items.length&&el.value!==countState.visit.storeId&&!data.visits.some(v=>v.id===countState.visit.id)){persistCount();countState=newDraft({id:'v-'+crypto.randomUUID(),storeId:el.value,date:countState.visit.date,notes:'',items:[],source:'manual'});toast('Rascunho anterior guardado. Nova contagem iniciada.');}
  else countState.visit.storeId=el.value;
  persistCount();renderCount();return true;
 }
 if(countState&&el.id==='count-date'){if(!countReadonly){countState.visit.date=el.value;persistCount();}return true;}
 return false;
}
async function screenAction(name,el){
 const id=el.dataset.id;
 if(countSaving&&(name.startsWith('count-')||name==='delete-visit'||name==='discard-draft'))return true;
 if(name==='mobile-nav'){openMenu();return true;}
 if(name==='menu-go'){closeMenu(()=>{location.hash=id;render();});return true;}
 if(name==='dashboard-tab'){viewState.dashboardTab=id;render();document.querySelector('#tab-'+id)?.focus({preventScroll:true});return true;}
 if(name==='zero-store'){viewState.zeroStoreId=id;viewState.dashboardTab='zeros';render();document.querySelector('#zero-store')?.focus();return true;}
 if(name==='store-view'){viewState.storeView=id;render();return true;}
 if(name==='product-page'){viewState.productPage=Math.max(1,Number(id)||1);render();return true;}
 if(name==='go-compare'){location.hash='compare';render();return true;}
 if(name==='laboratory-products'){filters.laboratory=id;viewState.productPage=1;location.hash='products';render();return true;}
 if(name==='store-visits'){modal.close();filters.storeId=id;filters.month='';location.hash='visits';render();return true;}
 if(name==='store-detail'){openDrawer('Detalhes da loja',storeDetail(data,selectedData(),id,isAdmin()),{action:name,id});return true;}
 if(name==='product-detail'){openDrawer('Detalhes do produto',productDetail(data,selectedData(el.dataset.store),id,isAdmin()),{action:name,id,store:el.dataset.store||''});return true;}
 if(name==='drafts'){
  if(modal.classList.contains('menu-sheet')){closeMenu(()=>action('drafts',{dataset:{}}));return true;}
  const drafts=listDrafts(browserStorage(),user.username);
  openDrawer('Seus rascunhos',drafts.length?`<p class="quiet-note">Guardados apenas neste navegador e nesta conta.</p><div class="attention-list">${drafts.map(s=>`<button class="attention-item" data-action="resume-draft" data-id="${e(s.visit.id)}"><span>${icon('visits')}</span><span><strong>${e(store(s.visit.storeId)?.name||s.visit.storeId+' · loja indisponível')}</strong><small>${date(s.visit.date)} · ${s.visit.items.length} produtos contados</small></span>${icon('arrow')}</button>`).join('')}</div>`:empty('Nenhum rascunho em aberto.','Comece uma nova contagem quando estiver na loja.'));return true;
 }
 if(name==='resume-draft'){
  const state=readDraft(browserStorage(),user.username,id);if(!state||!data.stores.some(s=>s.id===state.visit.storeId)){toast('Este rascunho não está disponível nesta base.',true);return true;}
  const existing=data.visits.find(v=>v.id===state.visit.id);
  if(existing&&state.baseVisit!==JSON.stringify(existing)){toast('A visita foi atualizada. O rascunho foi preservado; revise o registro atual antes de corrigir.',true);openVisit(existing.id);return true;}
  const allowed=new Set(visitProducts(data,existing||null).map(p=>p.id)),unavailable=state.visit.items.filter(i=>!allowed.has(i.productId));
  if(unavailable.length){if(!confirm(`${unavailable.length} produtos deste rascunho não estão mais disponíveis no catálogo. Retomar sem esses itens? As visitas salvas serão preservadas.`))return true;state.visit.items=state.visit.items.filter(i=>allowed.has(i.productId));saveDraft(browserStorage(),user.username,state);}
  countOrigin=null;countState=structuredClone(state);countReadonly=Boolean(existing)&&!isAdmin();countSaved=false;countSaving=false;dirty=false;renderCount();return true;
 }
 if(name==='delete-visit'&&countState){if(!isAdmin())throw new Error('Somente o administrador pode excluir visitas.');if(confirm('Excluir esta visita? As contagens anteriores serão preservadas e os indicadores recalculados.')){await command('deleteVisit',{id:countState.visit.id});clearDraft(browserStorage(),user.username,countState.visit.id);countState=null;dirty=false;modal.close();render();toast('Visita excluída. Indicadores atualizados.');}return true;}
 if(!name.startsWith('count-')&&name!=='discard-draft')return false;
 if(!countState)return true;
 if(countSaving)return true;
 if(name==='count-done'){countState=null;countSaved=false;modal.close();render();return true;}
 if(name==='discard-draft'){if(confirm('Descartar este rascunho? As visitas já salvas continuam preservadas.')){clearDraft(browserStorage(),user.username,countState.visit.id);countState=null;dirty=false;modal.close();render();}return true;}
 if(name==='count-back'){if(!countInputValid())return true;if(countSaved||countState.step==='review'&&countState.baseVisit){await returnFromVisit();}else if(countState.step==='review'||countState.view==='list'){countState.step='count';countState.view='focus';persistCount();renderCount();}else if(countState.step==='count'&&countState.cursor>0){countState.cursor--;persistCount();renderCount();}else await returnFromVisit();return true;}
 if(name==='count-settings'){if(!countReadonly){countState.step='setup';persistCount();renderCount();}return true;}
 if(name==='count-start'){
  const input=document.querySelector('#count-date');if(!input?.checkValidity()){input?.reportValidity();return true;}
  if(!data.stores.some(s=>s.id===countState.visit.storeId))throw new Error('Selecione uma loja para começar.');
  countState.step='count';countState.view='focus';persistCount();renderCount();return true;
 }
 if(!['count-zero','count-unknown'].includes(name)&&!countInputValid())return true;
 if(name==='count-list'){if(countState.step==='setup'){const dateInput=document.querySelector('#count-date');if(!dateInput?.checkValidity()){dateInput?.reportValidity();return true;}}countState.view=countState.view==='list'?'focus':'list';if(countState.step==='setup'||countState.step==='review')countState.step='count';persistCount();renderCount();return true;}
 if(name==='count-focus'){countState.view='focus';countState.step='count';persistCount();renderCount();return true;}
 if(name==='count-review'){countState.step='review';countState.view='list';persistCount();renderCount();return true;}
 const catalog=catalogFor(data,countState),product=catalog[countState.cursor];
 if(name==='count-jump'){countState.cursor=Math.min(catalog.length-1,Math.max(0,Number(id)||0));countState.step='count';countState.view='focus';persistCount();renderCount();return true;}
 if(name==='count-next'||name==='count-prev'){
  if(name==='count-next'&&countState.cursor===catalog.length-1){countState.step='review';countState.view='list';}else countState.cursor=Math.max(0,Math.min(catalog.length-1,countState.cursor+(name==='count-next'?1:-1)));
  persistCount();renderCount();document.querySelector('#count-product-title')?.focus({preventScroll:true});return true;
 }
 if(['count-plus','count-minus','count-zero','count-unknown'].includes(name)){
  if(countReadonly||!product)return true;
  const current=countState.visit.items.find(i=>i.productId===product.id)?.stock??null;
  const value=name==='count-unknown'?null:name==='count-zero'?0:name==='count-plus'?(current??0)+1:Math.max(0,(current??0)-1);
  countState=setQuantity(countState,product.id,value);persistCount();renderCount(name==='count-minus'?'down':'up');document.querySelector('[data-action="'+name+'"]')?.focus({preventScroll:true});return true;
 }
 if(name==='count-save'){
  if(countReadonly)return true;
  if(!countProgress(data,countState).counted)throw new Error('Confira pelo menos um produto antes de salvar.');
  const existing=data.visits.find(v=>v.id===countState.visit.id);
  if(existing&&countState.baseVisit!==JSON.stringify(existing))throw new Error('A visita foi atualizada desde este rascunho. Reabra o registro antes de corrigir.');
  countSaving=true;renderCount();
  try{await command('saveVisit',visitPayload(countState));filters.month=countState.visit.date.slice(0,7);clearDraft(browserStorage(),user.username,countState.visit.id);countSaved=true;countSaving=false;dirty=false;renderCount();render();}
  catch(error){countSaving=false;persistCount();renderCount();formError(error);}return true;
 }
 return false;
}
document.addEventListener('keydown',event=>{
 const tab=event.target.closest?.('.result-tabs [role=tab]');
 if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=[...document.querySelectorAll('.result-tabs [role=tab]')],i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();}
 if(event.key==='Enter'&&event.target.id==='counter-quantity'){event.preventDefault();action('count-next',{dataset:{}});}
});
document.addEventListener('click',event=>{
 const summary=event.target.closest?.('.visit-row>summary');if(!summary)return;
 const details=summary.parentElement,wrapper=details.querySelector('.visit-expansion');
 if(!wrapper?.animate||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 event.preventDefault();if(details.dataset.animating)return;details.dataset.animating='true';
 const closing=details.open;if(!closing)details.open=true;
 const height=wrapper.scrollHeight;wrapper.style.overflow='hidden';
 const animation=wrapper.animate(closing?[{height:height+'px',opacity:1},{height:'0px',opacity:0}]:[{height:'0px',opacity:0},{height:height+'px',opacity:1}],{duration:220,easing:'ease-in-out'});
 animation.onfinish=()=>{if(closing)details.open=false;wrapper.style.overflow='';delete details.dataset.animating;};
 animation.oncancel=()=>{wrapper.style.overflow='';delete details.dataset.animating;};
});
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el){event.preventDefault();action(el.dataset.action,el);}});
document.querySelector('#help-button').addEventListener('click',()=>data&&openHelp());
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});});
window.addEventListener('beforeunload',event=>{persistCount();if(dirty){event.preventDefault();event.returnValue='';}});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
document.addEventListener('input',event=>{const el=event.target;if(handleScreenInput(el))return;if(el.dataset.searchKind){searches[el.dataset.searchKind]=el.value;applySearch();}if(modal.contains(el)){dirty=true;}});
document.addEventListener('change',async event=>{const el=event.target;
 if(handleScreenChange(el))return;
 if(el.id.startsWith('compare-')){comparison[{'compare-store':'storeId','compare-from':'fromId','compare-to':'toId','compare-lab':'laboratory','compare-mode':'mode'}[el.id]]=el.value;if(el.id==='compare-store'){comparison.fromId='';comparison.toId='';}render();}
 if(el.id==='catalog-view'){catalogView=el.value;viewState.productPage=1;render();}
 if(el.id.startsWith('filter-')){viewState.productPage=1;if(el.id==='filter-store')viewState.zeroStoreId=el.value;filters[{'filter-month':'month','filter-store':'storeId','filter-lab':'laboratory'}[el.id]]=el.value;render();}


 if(el.id==='backup-file'&&el.files[0]){try{if(el.files[0].size>1800000)throw new Error('Backup acima do limite de 1,8 MB.');const backup=JSON.parse(await el.files[0].text());validateState(backup);if(!confirm(`Restaurar ${backup.visits.length} visitas e substituir a base atual? Exporte um backup antes de continuar.`))return;await command('restore',backup);render();toast('Backup restaurado.');}catch(error){toast(error.message,true);}finally{el.value='';}}
});
document.addEventListener('submit',async event=>{event.preventDefault();const form=event.target;try{
 if(form.id==='store-form'){const value=id=>document.querySelector('#'+id).value;const code=value('store-code').trim();if(code!==draft.id&&data.stores.some(s=>s.id===code))throw new Error('Já existe uma loja com esse código. Abra o cadastro existente para editar.');await command('saveStore',{...draft,id:code,name:value('store-name').trim(),city:value('store-city').trim(),buyer:value('store-buyer').trim(),notes:value('store-notes'),official:true});dirty=false;closeModal();render();toast('Loja salva.');}
 else if(form.id==='product-form'){const value=id=>document.querySelector('#'+id).value.trim();await command('saveProduct',{...draft,name:value('product-name'),code:value('product-code'),laboratory:value('product-lab'),category:value('product-category'),unit:value('product-unit')});dirty=false;closeModal();render();toast('Produto salvo.');}
 else if(form.id==='settings-form'){await command('settings',{targetDays:Number(document.querySelector('#target-days').value)});render();toast('Meta de cobertura atualizada.');}
 }catch(error){formError(error);}
});
load();
