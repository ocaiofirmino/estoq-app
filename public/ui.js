const paths={
 overview:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-8h6v8',stores:'M3 10h18l-2-6H5l-2 6ZM4 10v10h16V10M9 20v-7h6v7',
 products:'M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9',laboratories:'M9 3h6M10 3v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10',
 visits:'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 14l3 3 5-5',movements:'M5 4v11a3 3 0 0 0 3 3h11M15 14l4 4-4 4M19 3v6M16 6l3-3 3 3',
 reports:'M5 3h10l4 4v14H5V3ZM14 3v5h5M8 17v-4M12 17V9M16 17v-6',compare:'M3 6h9M6 3 3 6l3 3M21 18h-9M18 15l3 3-3 3M17 3v7M7 14v7',
 settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',plus:'M12 5v14M5 12h14',minus:'M5 12h14',arrow:'M5 12h14M14 7l5 5-5 5',back:'M19 12H5M10 7l-5 5 5 5',chevron:'m8 10 4 4 4-4',
 down:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',stock:'M3 7l9-4 9 4v13H3V7ZM3 9h18M8 13h8M8 17h5',chart:'M4 3v17h17M8 15l4-5 4 2 5-7',
 info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',alert:'m12 3 10 18H2L12 3ZM12 9v5M12 17h.01',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
 clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',close:'M6 6l12 12M6 18 18 6',check:'M5 12l4 4L19 6',edit:'m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',
 print:'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6v-7',list:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',grid:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',logout:'M9 3H4v18h5M9 12h12M17 8l4 4-4 4',leaf:'M12 21V9M12 15C3 16 2 8 3 5c6-1 10 2 9 10ZM12 11c-1-7 5-10 9-9 1 6-3 11-9 9Z'
};
export const icon=name=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6"><path d="${paths[name]||paths.products}"/></svg>`;
export const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>n==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n);
export const date=d=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'Sem visita';
export const monthName=m=>m?new Date(m+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'Todo o histórico';
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
export const normalize=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const button=(label,action,which='primary',ico='plus',attrs='')=>`<button type="button" class="button ${which}" data-action="${e(action)}" ${attrs}>${icon(ico)}<span>${e(label)}</span></button>`;
export const heading=(title,subtitle,actions='',eyebrow='ESTOQ · SEU ACOMPANHAMENTO')=>`<div class="page-heading"><div><div class="eyebrow">${e(eyebrow)}</div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div><div class="page-actions">${actions}</div></div>`;
export const badge=(text,color='')=>`<span class="badge ${e(color)}">${icon(color==='orange'?'alert':color==='red'?'stock':color==='green'?'check':'info')}${e(text)}</span>`;
export const empty=(title,description,action='')=>`<div class="empty-state">${icon('leaf')}<h3>${e(title)}</h3><p>${e(description)}</p>${action}</div>`;
export const progress=(count,total)=>`<span class="progress-ring" style="--progress:${total?Math.min(100,count/total*100):0}" role="img" aria-label="${count} de ${total} produtos conferidos"></span>`;
export function reading(stock,previous){
 if(stock==null)return {label:'Não conferido',color:'',delta:null};
 if(previous==null)return {label:stock===0?'Zero confirmado · dia zero':'Dia zero · referência inicial',color:stock===0?'red':'purple',delta:null};
 const delta=stock-previous;
 return {label:delta<0?`Saída estimada −${fmt(-delta)}`:delta>0?`Possível reposição +${fmt(delta)}`:stock===0?'Zero confirmado · sem alteração':'Quantidade sem alteração',color:delta<0?'orange':delta>0?'green':stock===0?'red':'',delta};
}
