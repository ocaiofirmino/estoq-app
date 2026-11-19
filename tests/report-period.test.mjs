import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPeriod} from '../public/report-period.js';
import {pfReportSheets} from '../public/export-pf.js';
import {createXlsx} from '../public/xlsx.js';

const example=()=>({schemaVersion:1,settings:{targetDays:30},
  stores:['PF01','PF02','PF03'].map(id=>({id,name:'Loja '+id,official:true})),
  products:[{id:'a',name:'Produto A',code:'A',laboratory:'Lab A'},{id:'b',name:'Produto B',code:'B',laboratory:'Lab B'}],
  visits:[
    {id:'next-year',storeId:'PF02',date:'2027-01-01',items:[{productId:'a',stock:6}]},
    {id:'day-zero',storeId:'PF01',date:'2024-02-29',items:[{productId:'a',stock:12},{productId:'b',stock:4}]},
    {id:'year-end',storeId:'PF02',date:'2026-12-31',items:[{productId:'a',stock:7}]},
    {id:'nov-next',storeId:'PF01',date:'2026-11-20',items:[{productId:'b',stock:2}]},
    {id:'previous-year',storeId:'PF01',date:'2025-12-31',items:[{productId:'a',stock:10}]},
    {id:'zero',storeId:'PF01',date:'2026-11-19',items:[{productId:'a',stock:0}]},
    {id:'year-start',storeId:'PF01',date:'2026-01-01',items:[{productId:'a',stock:9}]},
  ],
});
const visitRows=sheet=>sheet.rows.filter(row=>row[0] instanceof Date);
const dates=sheet=>visitRows(sheet).map(row=>row[0].toISOString().slice(0,10)).sort();

test('dia específico tem limites inclusivos e rejeita datas inexistentes',()=>{
  const period=reportPeriod({type:'day',day:'2024-02-29'});
  assert.deepEqual([period.startDate,period.endDate,period.filename],['2024-02-29','2024-02-29','2024-02-29']);
  assert.equal(period.label,'Dia 29/02/2024');
  for(const day of ['', '2026-02-29','2026-11-31','1900-02-29','0000-01-01','2026-13-01'])
    assert.throws(()=>reportPeriod({type:'day',day}),/dia válido/);
});

test('mês considera o último dia real e anos bissextos, inclusive dezembro',()=>{
  for(const [month,last] of [['2024-02','2024-02-29'],['2026-02','2026-02-28'],['2026-11','2026-11-30'],['2026-12','2026-12-31']]){
    const period=reportPeriod({type:'month',month});
    assert.equal(period.startDate,month+'-01');assert.equal(period.endDate,last);assert.equal(period.filename,month);
  }
  for(const month of ['', '2026-13','2026-00','0000-02'])assert.throws(()=>reportPeriod({type:'month',month}),/mês e ano válidos/);
});

test('ano abrange janeiro a dezembro sem aceitar valores incompletos ou fracionados',()=>{
  const period=reportPeriod({type:'year',year:'2025'});
  assert.deepEqual([period.startDate,period.endDate,period.label,period.filename],['2025-01-01','2025-12-31','Ano de 2025','2025']);
  for(const year of ['',0,-1,10000,2026.5,'dois mil'])assert.throws(()=>reportPeriod({type:'year',year}),/ano válido/);
  assert.throws(()=>reportPeriod({type:'unknown'}),/período válido/);
});

test('o dia escolhido no pop-up substitui o mês da tela e mantém zero diferente de branco',()=>{
  const [sheet]=pfReportSheets(example(),{month:'2026-10',period:{type:'day',day:'2026-11-19'}});
  assert.deepEqual(dates(sheet),['2026-11-19']);
  assert.deepEqual(visitRows(sheet)[0].slice(1),[0,null]);
  assert.equal(sheet.sectionRows.length,3);
});

test('os relatórios mensal e anual não vazam contagens de outros meses ou anos',()=>{
  const [month]=pfReportSheets(example(),{month:'2024-02',period:{type:'month',month:'2026-11'}});
  assert.deepEqual(dates(month),['2026-11-19','2026-11-20']);
  const [year,context]=pfReportSheets(example(),{month:'2026-11',period:{type:'year',year:2026}});
  assert.deepEqual(dates(year),['2026-01-01','2026-11-19','2026-11-20','2026-12-31']);
  assert.equal(context.rows.find(row=>row[0]==='Período')[1],'Ano de 2026');
  assert.equal(context.rows.find(row=>row[0]==='Data inicial')[1].toISOString().slice(0,10),'2026-01-01');
  assert.equal(context.rows.find(row=>row[0]==='Data final')[1].toISOString().slice(0,10),'2026-12-31');
});

test('geral inclui todas as visitas desde o dia zero mesmo com novembro selecionado na tela',()=>{
  const [sheet,context]=pfReportSheets(example(),{month:'2026-11',period:{type:'all'}});
  assert.deepEqual(dates(sheet),['2024-02-29','2025-12-31','2026-01-01','2026-11-19','2026-11-20','2026-12-31','2027-01-01']);
  assert.equal(context.rows.find(row=>row[0]==='Data inicial')[1].toISOString().slice(0,10),'2024-02-29');
  assert.equal(context.rows.find(row=>row[0]==='Visitas na seleção')[1],7);
});

test('loja e laboratório continuam restringindo a exportação em qualquer período',()=>{
  const [sheet]=pfReportSheets(example(),{storeId:'PF01',laboratory:'Lab B',period:{type:'year',year:'2026'}});
  assert.equal(sheet.sectionRows.length,1);
  assert.equal(sheet.rows[1].length,2);
  assert.deepEqual(visitRows(sheet).map(row=>row.slice(1)),[[null],[null],[2]]);
});

test('períodos sem visitas e históricos vazios continuam gerando arquivos válidos',()=>{
  for(const period of [{type:'all'},{type:'day',day:'2030-01-01'},{type:'year',year:2030}]){
    const sheets=pfReportSheets({...example(),visits:[]},{period});
    assert.equal(visitRows(sheets[0]).length,0);
    assert.doesNotThrow(()=>createXlsx(sheets));
  }
});
