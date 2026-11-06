import test from 'node:test';
import assert from 'node:assert/strict';
import {selectData,selectReport,groupProductStores} from '../public/domain.js';
import {reportSheets} from '../public/export-excel.js';
import {reportCsvRows} from '../public/report-csv.js';

// Contagens sintéticas, em ordem propositalmente diferente da cronológica.
const example=()=>({schemaVersion:1,settings:{targetDays:30},
  products:[
    {id:'p-a',code:'A',name:'Produto A',laboratory:'Laboratório A',active:true},
    {id:'p-b',code:'B',name:'Produto B',laboratory:'Laboratório B',active:true},
  ],
  stores:['PF01','PF02','PF03'].map(id=>({id,name:'Loja '+id,city:'Cidade de teste'})),
  visits:[
    {id:'jan',storeId:'PF01',date:'2027-01-02',items:[{productId:'p-a',stock:6},{productId:'p-b',stock:null}]},
    {id:'nov-zero',storeId:'PF02',date:'2026-11-20',items:[{productId:'p-a',stock:0}]},
    {id:'oct-first',storeId:'PF01',date:'2026-10-04',items:[{productId:'p-a',stock:10},{productId:'p-b',stock:3}]},
    {id:'nov-partial',storeId:'PF01',date:'2026-11-08',items:[{productId:'p-a',stock:null},{productId:'p-b',stock:4}]},
    {id:'oct-second-store',storeId:'PF02',date:'2026-10-10',items:[{productId:'p-a',stock:5},{productId:'p-b',stock:0}]},
    {id:'nov-first',storeId:'PF02',date:'2026-11-03',items:[{productId:'p-a',stock:2},{productId:'p-b',stock:null}]},
    {id:'nov-uncounted',storeId:'PF03',date:'2026-11-26',items:[{productId:'p-a',stock:null},{productId:'p-b',stock:null}]},
    {id:'oct-last',storeId:'PF01',date:'2026-10-20',items:[{productId:'p-a',stock:8},{productId:'p-b',stock:null}]},
  ],
});
const pairs=selection=>selection.balances.map(b=>[b.storeId,b.productId,b.stock,b.countDate]).sort();

test('novembro exclui lojas e produtos conferidos somente em outubro',()=>{
  const data=example(),november=selectData(data,{month:'2026-11'});
  assert.deepEqual(pairs(november),[
    ['PF01','p-b',4,'2026-11-08'],['PF02','p-a',0,'2026-11-20'],
  ]);
  assert.equal(november.totalStock,4);
  assert.equal(november.counted,2);
  assert.equal(november.visitedStores,2);
  assert.equal(november.zeroStock,1);
  const rows=groupProductStores(november),a=rows.find(row=>row.product.id==='p-a'),b=rows.find(row=>row.product.id==='p-b');
  assert.deepEqual(a.withStock,[]);
  assert.deepEqual(a.withoutStock.map(location=>location.store.id),['PF02']);
  assert.deepEqual(b.withStock.map(location=>location.store.id),['PF01']);
  assert.equal(b.counted,1);
  assert.equal(b.storeCount,3);
});

test('uma loja visitada em outubro não aparece como conferida em novembro',()=>{
  const data=example();
  data.visits=data.visits.filter(visit=>visit.id!=='nov-partial');
  const november=selectData(data,{month:'2026-11'});
  assert.deepEqual(november.balances.map(b=>b.storeId),['PF02']);
  assert.equal(november.visitedStores,1);
  assert.equal(november.counted,1);
  assert.equal(november.totalStock,0);
});

test('o mês usa a última contagem de cada produto/PF e mantém branco diferente de zero',()=>{
  const october=selectData(example(),{month:'2026-10'});
  assert.deepEqual(pairs(october),[
    ['PF01','p-a',8,'2026-10-20'],['PF01','p-b',3,'2026-10-04'],
    ['PF02','p-a',5,'2026-10-10'],['PF02','p-b',0,'2026-10-10'],
  ]);
  assert.equal(october.totalStock,16);
  assert.equal(october.counted,4);
  assert.equal(october.visitedStores,2);
  assert.equal(october.zeroStock,1);
});

test('um mês sem contagem não herda saldos e não estima movimentações',()=>{
  const december=selectData(example(),{month:'2026-12'});
  assert.deepEqual(december.balances,[]);
  assert.deepEqual(december.movements,[]);
  assert.equal(december.counted,0);
  assert.equal(december.visitedStores,0);
  assert.equal(december.outgoing,null);
  assert.equal(december.possibleRestock,null);
  const report=selectReport(example(),{month:'2026-12'});
  assert.deepEqual(report.periods.map(period=>period.month),['2026-12']);
  assert.equal(report.counted,0);
  assert.equal(report.storeMonths,0);
  assert.equal(report.outgoing,null);
});

test('as variações de novembro usam a referência histórica de outubro',()=>{
  const november=selectData(example(),{month:'2026-11'});
  const first=november.movements.find(m=>m.visitId==='nov-first'&&m.productId==='p-a');
  assert.equal(first.previousStock,5);
  assert.equal(first.previousDate,'2026-10-10');
  assert.equal(first.outgoing,3);
  assert.equal(november.outgoing,5);
  assert.equal(november.possibleRestock,1);
  assert.equal(november.comparable,3);
});

test('o total soma fechamentos mensais em ordem de mês/ano sem somar revisitas',()=>{
  const report=selectReport(example());
  assert.deepEqual(report.periods.map(period=>period.month),['2026-10','2026-11','2027-01']);
  assert.deepEqual(report.periods.map(period=>period.totalStock),[16,4,6]);
  assert.equal(report.totalStock,26);
  assert.equal(report.counted,7);
  assert.equal(report.storeMonths,5);
  assert.equal(report.visitedStores,2);
  assert.equal(report.outgoing,9);
  assert.equal(report.possibleRestock,1);
  assert.equal(report.comparable,5);
  assert.equal(report.zeroStock,2);
  // O saldo histórico mais recente tem outra finalidade e não é o acumulado mensal.
  assert.notEqual(report.totalStock,selectData(example()).totalStock);
});

test('filtros de loja e laboratório valem no mês e no acumulado',()=>{
  const data=example();
  const november=selectData(data,{month:'2026-11',laboratory:'Laboratório A'});
  assert.equal(november.counted,1);
  assert.equal(november.visitedStores,1);
  assert.equal(november.totalStock,0);
  const filtered=selectReport(data,{storeId:'PF01',laboratory:'Laboratório A'});
  assert.equal(filtered.totalStock,14);
  assert.equal(filtered.counted,2);
  assert.equal(filtered.storeMonths,2);
  assert.equal(filtered.visitedStores,1);
  assert(filtered.periods.every(period=>period.stores.every(store=>store.id==='PF01')));
  assert(filtered.periods.every(period=>period.products.every(product=>product.laboratory==='Laboratório A')));
  const novemberPeriod=filtered.periods.find(period=>period.month==='2026-11');
  assert.equal(novemberPeriod.counted,0);
});

test('relatórios vazios preservam a ausência de referência',()=>{
  const data=example();data.visits=[];
  const report=selectReport(data);
  assert.deepEqual(report.periods,[]);
  assert.equal(report.counted,0);
  assert.equal(report.visitedStores,0);
  assert.equal(report.storeMonths,0);
  assert.equal(report.outgoing,null);
  assert.equal(report.possibleRestock,null);
});

const records=rows=>rows.slice(1).map(row=>Object.fromEntries(rows[0].map((heading,index)=>[heading,row[index]])));

test('o Excel discrimina os meses em ordem e exporta o acumulado mensal',()=>{
  const sheets=reportSheets(example(),{},new Date('2027-01-03T12:00:00Z'));
  const summary=records(sheets.find(sheet=>sheet.name==='Resumo mensal').rows);
  assert.deepEqual(summary.map(row=>row['Mês']),['2026-10','2026-11','2027-01','Total acumulado']);
  assert.deepEqual(summary.map(row=>row['Estoque contado no mês']),[16,4,6,26]);
  assert.deepEqual(summary.map(row=>row['Lojas conferidas no mês']),[2,2,1,5]);
  for(const sheet of sheets.filter(sheet=>!['Contexto','Resumo mensal'].includes(sheet.name))){
    const months=records(sheet.rows).map(row=>row['Mês']);
    assert.deepEqual(months,[...months].sort(),`Ordem mensal na aba ${sheet.name}`);
  }
});

test('o Excel mensal mantém contagens antigas em branco e zero confirmado como zero',()=>{
  const sheets=reportSheets(example(),{month:'2026-11'});
  const stock=records(sheets.find(sheet=>sheet.name==='Estoque por produto').rows);
  assert(stock.every(row=>row['Mês']==='2026-11'));
  const old=stock.find(row=>row['Código da loja']==='PF01'&&row['Código do produto']==='A');
  const zero=stock.find(row=>row['Código da loja']==='PF02'&&row['Código do produto']==='A');
  assert.equal(old['Estoque contado'],null);
  assert.equal(old['Última contagem'],null);
  assert.equal(old['Última leitura'],'Não conferido');
  assert.equal(zero['Estoque contado'],0);
  const stores=records(sheets.find(sheet=>sheet.name==='Lojas').rows);
  const uncounted=stores.find(row=>row['Código da loja']==='PF03');
  assert.equal(uncounted['Estoque contado'],null);
  assert.equal(uncounted['Situação'],'Não conferida no mês selecionado');
});

test('o CSV exporta os mesmos meses, contagens e total sem carregar PFs antigas',()=>{
  const rows=records(reportCsvRows(example()));
  const summary=rows.filter(row=>row['Tipo']==='Total do mês');
  assert.deepEqual(summary.map(row=>row['Mês']),['2026-10','2026-11','2027-01']);
  assert.deepEqual(summary.map(row=>row['Estoque contado']),[16,4,6]);
  const total=rows.find(row=>row['Tipo']==='Total acumulado');
  assert.equal(total['Estoque contado'],26);
  assert.equal(total['Saída estimada'],9);
  const novemberA=rows.find(row=>row['Mês']==='2026-11'&&row['Código']==='A');
  assert.equal(novemberA['Estoque contado'],0);
  assert.equal(novemberA['PFs com estoque e quantidades'],'');
  assert.equal(novemberA['PFs sem estoque'],'PF02');
  assert.equal(novemberA['PFs conferidas'],1);
  assert.equal(novemberA['PFs não conferidas no mês'],2);
  const novemberOnly=records(reportCsvRows(example(),{month:'2026-11',storeId:'PF01',laboratory:'Laboratório A'}));
  assert(novemberOnly.every(row=>row['Mês']==='2026-11'));
  assert.equal(novemberOnly.find(row=>row['Tipo']==='Produto')['Estoque contado'],null);
  assert(!novemberOnly.some(row=>row['Tipo']==='Total acumulado'));
});
