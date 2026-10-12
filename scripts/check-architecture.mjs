/*
SUME DOCBLOCK
Nombre: scripts/check-architecture.mjs
Tipo: Lógica
Entradas: Código y mapa SUME del repositorio
Acciones: Verificar DOCBLOCKs, rutas trazadas y dependencias básicas
Salidas: Errores de arquitectura o confirmación del gate
*/
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const errors=[];
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const exists=name=>fs.existsSync(path.join(root,name));

function filesIn(folder){
 const result=[];
 for(const item of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
  const relative=path.posix.join(folder,item.name);
  if(item.isDirectory())result.push(...filesIn(relative));
  else if(item.isFile())result.push(relative);
 }
 return result;
}

const sourceFiles=[...filesIn('server'),...filesIn('web/src')]
 .filter(name=>/\.(?:mjs|ts|tsx|css)$/.test(name));
const sumeFiles=['entradas','logica','salidas','contratos']
 .flatMap(filesIn);
for(const name of [...sourceFiles,...sumeFiles]){
 const head=read(name).slice(0,600);
 const block=name.endsWith('.md')
  ?head.match(/^<!--[\s\S]*?-->/)?.[0]
  :head.match(/^\/\*[\s\S]*?\*\//)?.[0];
 if(!block?.includes('SUME DOCBLOCK'))
  errors.push(`${name}: falta SUME DOCBLOCK inicial`);
 for(const field of ['Nombre','Tipo','Entradas','Acciones','Salidas'])
  if(!new RegExp(`\\b${field}:`).test(block??''))
   errors.push(`${name}: falta el campo ${field}`);
}

for(const name of ['.sume','SUME-README.md','cambios/registro-cambios.md','mapa-global/arquitectura.yaml','contratos/http-api.md'])
 if(!exists(name))errors.push(`Falta ${name}`);

const routesSource=read('server/routes.mjs');
const expected=new Set();
for(const match of routesSource.matchAll(/route\s*===\s*'([^']+)'\s*&&\s*method\s*===\s*'([A-Z]+)'/g))
 expected.add(`${match[2]} ${match[1]}`);
for(const route of ['DELETE /api/transactions/:id','DELETE /api/debts/:id'])
 expected.add(route);

const map=read('mapa-global/arquitectura.yaml');
const routeBlocks=map.split(/^  - path: /m).slice(1);
const documented=new Set();
for(const block of routeBlocks){
 const route=block.match(/^([^\r\n]+)/)?.[1]?.trim();
 const method=block.match(/^    method: ([A-Z]+)/m)?.[1];
 if(!route||!method){errors.push('Ruta del mapa sin path o method');continue}
 const key=`${method} ${route}`;
 if(documented.has(key))errors.push(`Ruta duplicada en mapa: ${key}`);
 documented.add(key);
 for(const field of ['entrada','controlador','logica','contrato_entrada','contrato_salida','salida']){
  const value=block.match(new RegExp(`^    ${field}: ([^\\r\\n]+)`,'m'))?.[1]?.trim();
  if(!value||!exists(value))errors.push(`${key}: ${field} no apunta a un archivo real`);
 }
}
for(const key of expected)if(!documented.has(key))errors.push(`Ruta sin mapa: ${key}`);
for(const key of documented)if(!expected.has(key))errors.push(`Ruta del mapa sin código: ${key}`);
for(const match of map.matchAll(/^    file: ([^\r\n]+)/gm))
 if(!exists(match[1].trim()))errors.push(`Módulo o contrato inexistente: ${match[1]}`);

const core=read('server/core.mjs');
if(/from ['"]node:(?:sqlite|fs|http)|from ['"]\.\/store/.test(core))
 errors.push('server/core.mjs debe seguir siendo puro');
for(const name of sourceFiles.filter(file=>file.startsWith('server/'))){
 if(/from ['"][^'"]*web\//.test(read(name)))
  errors.push(`${name}: el servidor depende de la web`);
}
if(errors.length){
 for(const error of errors)console.error(`[arquitectura] ${error}`);
 process.exitCode=1;
}else{
 console.log(`Arquitectura válida: ${sourceFiles.length} archivos de código, ${sumeFiles.length} archivos SUME, ${documented.size} rutas.`);
}
