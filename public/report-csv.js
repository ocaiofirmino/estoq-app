import {selectReport,groupProductStores} from './domain.js';

export function reportCsvRows(data,filters={}){
  const report=selectReport(data,filters);
  const rows=[['Mês','Tipo','Produto','Código','Laboratório','Estoque contado','PFs com estoque e quantidades','PFs sem estoque','PFs conferidas','PFs não conferidas no mês','Saída estimada','Possível reposição','Observação']];
  for(const period of report.periods){
    for(const row of groupProductStores(period))rows.push([
      period.month,'Produto',row.product.name,row.product.code,row.product.laboratory,row.stock,
      row.withStock.map(b=>`${b.store.id}: ${b.stock} un.`).join(' / '),row.withoutStock.map(b=>b.store.id).join(' / '),
      row.counted,row.storeCount-row.counted,row.outgoing,row.possibleRestock,
      'Última contagem do produto em cada PF dentro deste mês. Demais lojas não conferidas no mês selecionado.',
    ]);
    rows.push([period.month,'Total do mês',null,null,null,period.counted?period.totalStock:null,null,null,null,null,period.outgoing,period.possibleRestock,`${period.visitedStores} de ${period.stores.length} lojas conferidas no mês; ${period.stores.length-period.visitedStores} não conferidas.`]);
  }
  if(!filters.month)rows.push(['Total acumulado','Total acumulado',null,null,null,report.counted?report.totalStock:null,null,null,null,null,report.outgoing,report.possibleRestock,`Soma das contagens mensais; ${report.storeMonths} conferências de lojas por mês em ${report.visitedStores} lojas distintas.`]);
  return rows;
}
