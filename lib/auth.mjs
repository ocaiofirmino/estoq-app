import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { accounts } from './accounts.mjs';
import { legacySessionToken, retireLegacyCookie } from './migrations/001-estoq.mjs';

const deriveKey=promisify(scrypt);
const COOKIE='estoq_session',SESSION_SECONDS=60*60*24*7;
const WINDOW_MS=15*60*1000,MAX_ATTEMPTS=10;
const digest=value=>createHash('sha256').update(value).digest('hex');
export const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});

export async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  const key=await deriveKey(password,salt,64,{N:65536,r:8,p:1,maxmem:128*1024*1024});
  return `scrypt$65536$8$1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password,encoded) {
  if(typeof encoded!=='string')return false;
  const [algorithm,n,r,p,salt,expected]=encoded.split('$');
  if(algorithm!=='scrypt'||!salt||!/^[a-f0-9]{128}$/.test(expected||'')||Number(n)!==65536||Number(r)!==8||Number(p)!==1)return false;
  const key=await deriveKey(password,salt,64,{N:Number(n),r:Number(r),p:Number(p),maxmem:128*1024*1024});
  return timingSafeEqual(key,Buffer.from(expected,'hex'));
}
function account(username) {
  const user=accounts[username];
  if(!user)return null;
  const envName=username==='caio'?'CAIO_PASSWORD_HASH':'LAYLAH_PASSWORD_HASH';
  const passwordHash=process.env[envName];
  return passwordHash ? {...user,username,passwordHash} : null;
}
function publicUser(user){return {username:user.username,name:user.name,role:user.role};}
function tokenFrom(request) {
  const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return raw!==undefined ? (/^[\w-]{43}$/.test(raw)?raw:null) : legacySessionToken(request);
}
function cookie(request,value,maxAge) {
  const secure=new URL(request.url).protocol==='https:';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
}
export function upgradeSessionCookie(request,response) {
  const token=legacySessionToken(request);
  const hasCurrent=(request.headers.get('cookie')||'').split(';').some(value=>value.trim().startsWith(COOKIE+'='));
  return retireLegacyCookie(request,response,token&&!hasCurrent?cookie(request,token,SESSION_SECONDS):null);
}
export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  return (!origin||origin===new URL(request.url).origin)&&request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function getSession(request,db,now=Date.now()) {
  const token=tokenFrom(request);if(!token)return null;
  const record=await db.prepare('SELECT username,expires_at,auth_version FROM estoq_sessions WHERE token_hash = ?').bind(digest(token)).first();
  if(!record||Number(record.expires_at)<=now)return null;
  const user=account(record.username);
  if(!user||record.auth_version!==digest(user.passwordHash))return null;
  return publicUser(user);
}
export async function login(request,db,now=Date.now()) {
  const fallback=account('caio');
  if(!fallback)return json({error:'O acesso ainda não está configurado.'},503);
  const raw=await request.text();if(raw.length>4096)return json({error:'Dados de acesso inválidos.'},400);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Dados de acesso inválidos.'},400);}
  const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
  const password=typeof body.password==='string'?body.password:'';
  if(!/^[a-z0-9_-]{1,40}$/.test(username)||password.length<1||password.length>1024)return json({error:'Usuário ou senha incorretos.'},401);
  const user=account(username);
  const key=digest(user?username:'unknown'),cutoff=now-WINDOW_MS;
  const limit=await db.prepare(`INSERT INTO estoq_login_limits (account_key,attempts,window_start)
    VALUES (?,1,?) ON CONFLICT (account_key) DO UPDATE SET
    attempts = CASE WHEN estoq_login_limits.window_start < ? THEN 1 ELSE estoq_login_limits.attempts + 1 END,
    window_start = CASE WHEN estoq_login_limits.window_start < ? THEN ? ELSE estoq_login_limits.window_start END
    RETURNING attempts,window_start`).bind(key,now,cutoff,cutoff,now).first();
  if(Number(limit.attempts)>MAX_ATTEMPTS)return json({error:'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'},429,{'Retry-After':String(Math.max(1,Math.ceil((Number(limit.window_start)+WINDOW_MS-now)/1000)))});
  const valid=await verifyPassword(password,user?.passwordHash||fallback.passwordHash);
  if(!user||!valid)return json({error:'Usuário ou senha incorretos.'},401);
  await db.prepare('DELETE FROM estoq_login_limits WHERE account_key = ?').bind(key).run();
  await db.prepare('DELETE FROM estoq_sessions WHERE expires_at <= ?').bind(now).run();
  const old=tokenFrom(request);
  if(old)await db.prepare('DELETE FROM estoq_sessions WHERE token_hash = ?').bind(digest(old)).run();
  const token=randomBytes(32).toString('base64url');
  await db.prepare('INSERT INTO estoq_sessions (token_hash,username,auth_version,expires_at,created_at) VALUES (?,?,?,?,?)')
    .bind(digest(token),username,digest(user.passwordHash),now+SESSION_SECONDS*1000,now).run();
  return retireLegacyCookie(request,json({user:publicUser(user)},200,{'Set-Cookie':cookie(request,token,SESSION_SECONDS)}));
}
export async function logout(request,db) {
  const token=tokenFrom(request);
  if(token)await db.prepare('DELETE FROM estoq_sessions WHERE token_hash = ?').bind(digest(token)).run();
  return retireLegacyCookie(request,json({ok:true},200,{'Set-Cookie':cookie(request,'',0)}));
}
