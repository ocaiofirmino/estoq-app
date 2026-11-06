import { getSession, login, logout, json, sameOrigin, upgradeSessionCookie } from './auth.mjs';
import { handleApi } from './api.mjs';

export async function handleRequest(request,db,initial,mode='cloud') {
  const path=new URL(request.url).pathname;
  if(!['GET','POST'].includes(request.method))return json({error:'Método não permitido.'},405);
  if(request.method==='POST'){
    if(!sameOrigin(request))return json({error:'Origem não permitida.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Envie dados JSON.'},415);
    if(Number(request.headers.get('content-length')||0)>2000000)return json({error:'Arquivo muito grande.'},413);
  }
  try {
    if(path==='/api/auth/login'&&request.method==='POST')return await login(request,db);
    if(path==='/api/auth/logout'&&request.method==='POST')return await logout(request,db);
    const user=await getSession(request,db);
    if(!user)return json({error:'Entre na sua conta para continuar.'},401);
    if(path==='/api/auth/me'&&request.method==='GET')return upgradeSessionCookie(request,json({user}));
    if(path==='/api/state')return upgradeSessionCookie(request,await handleApi(request,db,initial,mode,user));
    return json({error:'Rota não encontrada.'},404);
  }catch(error){console.error('Estoq: falha na API',error.code||error.name);return json({error:'Não foi possível acessar o sistema. Tente novamente.'},500);}
}
