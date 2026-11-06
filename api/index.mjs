import initial from '../lib/initial-data.json' with { type:'json' };
import { getCloudDatabase } from '../lib/database.mjs';
import { handleRequest } from '../lib/router.mjs';
import { json } from '../lib/auth.mjs';

async function handler(request) {
  try {
    const url=new URL(request.url),route=url.searchParams.get('route');
    if(route&&/^[a-z/]+$/.test(route)){
      url.pathname='/api/'+route;url.searchParams.delete('route');
      request=new Request(url,request);
    }
    return await handleRequest(request,await getCloudDatabase(),initial,'cloud');
  }catch(error){console.error('Estoq: banco indisponível',error.code||error.name);return json({error:'O banco de dados ainda não está disponível.'},503);}
}
export const GET=handler;
export const POST=handler;
