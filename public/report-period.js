const validDate=value=>typeof value==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function reportPeriod({type='all',day='',month='',year=''}={}){
  if(type==='all')return {type,startDate:'',endDate:'',label:'Todo o histórico — desde o dia zero',filename:'historico'};
  if(type==='day'){
    if(!validDate(day))throw new Error('Selecione um dia válido para o relatório.');
    return {type,startDate:day,endDate:day,label:'Dia '+day.split('-').reverse().join('/'),filename:day};
  }
  if(type==='month'){
    if(typeof month!=='string'||!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Selecione um mês e ano válidos para o relatório.');
    const first=new Date(month+'-01T00:00:00Z'),last=new Date(first);
    last.setUTCMonth(last.getUTCMonth()+1,0);
    return {type,startDate:month+'-01',endDate:last.toISOString().slice(0,10),
      label:first.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}),filename:month};
  }
  if(type==='year'){
    const value=String(year).trim();
    if(!/^\d{1,4}$/.test(value)||Number(value)<1)throw new Error('Selecione um ano válido, de 1 a 9999.');
    const normalized=value.padStart(4,'0');
    return {type,startDate:normalized+'-01-01',endDate:normalized+'-12-31',label:'Ano de '+normalized,filename:normalized};
  }
  throw new Error('Selecione um período válido para o relatório.');
}
