import test from 'node:test';
import assert from 'node:assert/strict';
import {pfReportSheets} from '../public/export-pf.js';
import {reportSheets} from '../public/export-excel.js';
import {createXlsx} from '../public/xlsx.js';

const example=()=>({schemaVersion:1,settings:{targetDays:30},audit:[],
  stores:['PF10','PF02','PF01','PF03'].map(id=>({id,name:'Loja '+id})),
  products:[
    {id:'a',code:'A',name:'Produto A',laboratory:'Laboratório A',active:true},
    {id:'b',code:'B',name:'Produto B',laboratory:'Laboratório B',active:true},
    {id:'old',code:'ANT',name:'Produto descontinuado',laboratory:'Laboratório A',active:false},
  ],
  visits:[
    {id:'nov-last',storeId:'PF01',date:'2026-11-19',items:[{productId:'a',stock:0}]},
    {id:'dec',storeId:'PF10',date:'2026-12-01',items:[{productId:'b',stock:9}]},
    {id:'nov-second',storeId:'PF01',date:'2026-11-03',items:[{productId:'a',stock:7},{productId:'b',stock:2}]},
    {id:'oct',storeId:'PF01',date:'2026-10-20',items:[{productId:'a',stock:10},{productId:'b',stock:3},{productId:'old',stock:2}]},
    {id:'nov-pf02',storeId:'PF02',date:'2026-11-12',items:[{productId:'b',stock:4}]},
    {id:'nov-first',storeId:'PF01',date:'2026-11-02',items:[{productId:'a',stock:5},{productId:'b',stock:null}]},
  ],
});
function block(sheet,id){
  const index=sheet.sectionRows.findIndex(row=>sheet.rows[row][0].startsWith(id+' · '));
  const start=sheet.sectionRows[index],end=sheet.sectionRows[index+1]??sheet.rows.length;
  return {header:sheet.rows[start+1],visits:sheet.rows.slice(start+2,end).filter(row=>row[0] instanceof Date)};
}
const date=value=>value.toISOString().slice(0,10);
const xmls=sheets=>new TextDecoder().decode(createXlsx(sheets)).match(/<worksheet\b[\s\S]*?<\/worksheet>/g);

test('o relatório agrupa todas as PFs e mantém cada visita em ordem cronológica',()=>{
  const [sheet]=pfReportSheets(example());
  assert.deepEqual(sheet.sectionRows.map(row=>sheet.rows[row][0]),['PF01 · Loja PF01','PF02 · Loja PF02','PF03 · Loja PF03','PF10 · Loja PF10']);
  const pf01=block(sheet,'PF01');
  assert.equal(pf01.header[0],'Data da visita');
  assert(pf01.header[1].startsWith('Produto A\n'));
  assert.deepEqual(pf01.visits.map(row=>[date(row[0]),...row.slice(1)]),[
    ['2026-10-20',10,3,2],['2026-11-02',5,null,null],['2026-11-03',7,2,null],['2026-11-19',0,null,null],
  ]);
});

test('quantidades não são somadas nem herdadas de visitas anteriores e zero continua numérico',()=>{
  const [sheet]=pfReportSheets(example(),{month:'2026-11'});
  const visits=block(sheet,'PF01').visits;
  assert.equal(visits.length,3);
  assert.deepEqual(visits.at(-1).slice(1),[0,null,null]);
  assert.equal(typeof visits.at(-1)[1],'number');
  assert(!visits.some(row=>date(row[0]).startsWith('2026-10')));
  assert.deepEqual(block(sheet,'PF02').visits[0].slice(1),[null,4,null]);
});

test('filtros de PF, mês e laboratório restringem as colunas e mantêm as datas das visitas',()=>{
  const [sheet,context]=pfReportSheets(example(),{storeId:'PF02',month:'2026-11',laboratory:'Laboratório A'});
  assert.equal(sheet.sectionRows.length,1);
  const pf02=block(sheet,'PF02');
  assert.equal(pf02.header.length,3);
  assert(pf02.header[2].includes('Produto descontinuado'));
  assert(!pf02.header.some(value=>value.includes('Laboratório B')));
  assert.deepEqual(pf02.visits.map(row=>[date(row[0]),...row.slice(1)]),[['2026-11-12',null,null]]);
  assert.equal(context.rows.find(row=>row[0]==='Visitas na seleção')[1],1);
});

test('lojas sem visitas permanecem no arquivo e bases vazias geram um Excel válido',()=>{
  const [sheet]=pfReportSheets(example(),{month:'2026-11'});
  const start=sheet.sectionRows.find(row=>sheet.rows[row][0].startsWith('PF03 · '));
  assert.deepEqual(sheet.rows[start+2],['Sem visitas no mês selecionado',null,null,null]);
  assert.equal(block(sheet,'PF10').visits.length,0);
  for(const data of [{...example(),products:[]},{...example(),stores:[],visits:[]},{...example(),visits:[]}]){
    assert.doesNotThrow(()=>createXlsx(pfReportSheets(data)));
  }
});

test('os cabeçalhos de PF ocupam a linha inteira no XLSX, com datas e quantidades tipadas',()=>{
  const sheets=pfReportSheets(example(),{month:'2026-11',storeId:'PF01'});
  const [xml]=xmls(sheets);
  assert.match(xml,/<mergeCell ref="A1:D1"\/>/);
  assert.match(xml,/<c r="D1" s="5"\/>/);
  assert.match(xml,/<c r="A3" s="6"><v>\d+<\/v><\/c>/);
  assert.match(xml,/<c r="B5" s="4"><v>0<\/v><\/c>/);
  assert.match(xml,/<c r="C5" s="4"\/>/);
  assert(!xml.includes('<autoFilter'));
  assert(!xml.includes('<pane'));
  assert.equal(sheets[1].name,'Contexto');
});

test('muitas lojas e produtos continuam em uma única tabela, inclusive depois da coluna Z',()=>{
  const data=example();
  data.stores=Array.from({length:120},(_,i)=>({id:'PF'+String(i+1).padStart(2,'0'),name:'Loja '+(i+1)}));
  data.products=Array.from({length:28},(_,i)=>({...data.products[0],id:'p'+i,name:'Produto '+i}));
  data.visits=[];
  const sheets=pfReportSheets(data),[xml]=xmls(sheets);
  assert.equal(sheets.length,2);
  assert.equal(sheets[0].sectionRows.length,120);
  assert.match(xml,/<mergeCell ref="A1:AC1"\/>/);
  assert.equal(sheets[0].rows[sheets[0].sectionRows.at(-1)][0],'PF120 · Loja 120');
});

test('a exportação existente mantém filtros, congelamento e cabeçalho no Excel',()=>{
  const sheets=reportSheets(example(),{month:'2026-11'});
  for(const xml of xmls(sheets)){
    assert.match(xml,/<pane ySplit="1" topLeftCell="A2"/);
    assert.match(xml,/<autoFilter ref="A1:/);
    assert.match(xml,/<c r="A1" s="1" t="inlineStr">/);
    assert(!xml.includes('<mergeCells'));
  }
});
