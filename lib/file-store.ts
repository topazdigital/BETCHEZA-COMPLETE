import fs from 'fs';import path from 'path';
function getStateDir(){
  if(process.env.APP_DIR) return path.join(process.env.APP_DIR,'.local','state','admin');
  if(fs.existsSync('/home/admin/apps/betcheza')) return '/home/admin/apps/betcheza/.local/state/admin';
  let dir=__dirname;for(let i=0;i<10;i++){if(fs.existsSync(path.join(dir,'package.json')))return path.join(dir,'.local','state','admin');const p=path.dirname(dir);if(p===dir)break;dir=p;}
  return path.join(process.cwd(),'.local','state','admin');
}
function ensureDir(d){try{fs.mkdirSync(d,{recursive:true})}catch{}}
export function fileStoreSet(key,value){try{const d=getStateDir();ensureDir(d);fs.writeFileSync(path.join(d,key+'.json'),JSON.stringify(value,null,2),'utf8')}catch(e){console.warn('[file-store] write failed:',e)}}