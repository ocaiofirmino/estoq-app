import { cp, mkdir, readdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const entry of await readdir('public',{withFileTypes:true})){
  if(!entry.isFile()||!/^.*\.(html|css|js|svg|png|webp|ico)$/.test(entry.name))continue;
  await cp(resolve('public',entry.name),resolve('dist',entry.name));
}
for(const name of await readdir('dist')){
  if(!/\.(html|css|js|svg)$/.test(name))continue;
  if((await readFile(resolve('dist',name),'utf8')).includes('scrypt$'))throw new Error('Conteúdo privado encontrado na saída pública.');
}
console.log('Estoq: interface pronta em dist/. API Node preparada em api/index.mjs.');
