import fs from 'node:fs';
import path from 'node:path';

const MANAGED_KEYS = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'];

function envValue(value){return JSON.stringify(String(value));}

export function updateGoogleEnv(file, values){
  for(const [key,value] of Object.entries(values))if(value&&/[\r\n]/.test(value))throw new Error(`${key} zawiera niedozwolony znak końca linii.`);
  const existing=fs.existsSync(file)?fs.readFileSync(file,'utf8').split(/\r?\n/):[];
  const nextValues={};for(const key of MANAGED_KEYS)if(values[key])nextValues[key]=values[key];
  const seen=new Set(),lines=existing.map(line=>{const match=line.match(/^\s*([A-Z0-9_]+)\s*=/);if(!match||!(match[1] in nextValues))return line;seen.add(match[1]);return`${match[1]}=${envValue(nextValues[match[1]])}`;});
  if(lines.length&&lines.at(-1)!=='')lines.push('');
  if(Object.keys(nextValues).some(key=>!seen.has(key))&&!lines.some(line=>line.includes('Google Drive OAuth')))lines.push('# Google Drive OAuth — zapisane przez kreator CRESCI');
  for(const key of MANAGED_KEYS)if(nextValues[key]&&!seen.has(key))lines.push(`${key}=${envValue(nextValues[key])}`);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${lines.join('\n').replace(/\n+$/,'')}\n`,{encoding:'utf8',mode:0o600});try{fs.chmodSync(file,0o600);}catch{/* Windows */}
}
