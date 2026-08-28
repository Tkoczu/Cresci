import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BackupManager, GoogleDriveProvider } from '../src/backup.js';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cresci-backup-test-')),driveCalls=[],driveFiles=[],imported=[];let tick=0;
  const payload=()=>({format:'gym-progress-backup',profiles:[{id:1}],exercises:[{id:1}],progress_entries:[{id:1}]});
  const google={status:()=>({configured:true,connected:true}),save:async(data,filename)=>{driveCalls.push({payload:data,filename});const file={provider:'drive',filename,id:`drive-${driveCalls.length}`,name:filename,created_at:new Date(Date.UTC(2026,7,27,10,0,tick)).toISOString()};driveFiles.unshift(file);return file;},list:async()=>driveFiles,load:async id=>driveFiles.find(file=>file.id===id)?.payload||payload(),prune:async keep=>driveFiles.splice(keep).map(file=>file.name)};
  const manager=new BackupManager({exportData:payload,importData:data=>{imported.push(data);return{profiles:data.profiles.length,exercises:data.exercises.length,entries:data.progress_entries.length};},settingsPath:path.join(root,'data','settings.json'),localDirectory:path.join(root,'backups'),googleDrive:google,now:()=>new Date(Date.UTC(2026,7,27,10,0,tick++))});
  return{root,driveCalls,driveFiles,imported,manager};
}

test('manual backup can save locally and to Google Drive together',async()=>{
  const{root,driveCalls,manager}=fixture();
  try{
    manager.updateSettings({local_enabled:true,drive_enabled:true,interval_hours:6});
    const result=await manager.run('manual');
    assert.equal(result.last_status,'success');assert.equal(result.results.length,2);assert.equal(driveCalls.length,1);
    const files=fs.readdirSync(path.join(root,'backups'));assert.equal(files.length,1);assert.match(files[0],/^CRESCI - ręczna - 27-08-2026/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('only three newest local backups are retained',async()=>{
  const{root,manager}=fixture();
  try{manager.updateSettings({local_enabled:true,drive_enabled:false,interval_hours:0});for(let i=0;i<4;i++)await manager.run('manual');const files=await manager.local.list();assert.equal(files.length,3);assert.ok(files.every(file=>file.name.startsWith('CRESCI - ręczna - ')));}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('restore saves a safety copy before importing selected data',async()=>{
  const{root,imported,manager}=fixture();
  const selected={format:'gym-progress-backup',profiles:[{id:2}],exercises:[{id:8}],progress_entries:[{id:19}]};
  try{manager.updateSettings({local_enabled:true,drive_enabled:false,interval_hours:0});await manager.local.save(selected,'Moja kopia.json');const result=await manager.restore({name:'Moja kopia.json'});assert.equal(result.ok,true);assert.equal(imported[0].progress_entries[0].id,19);const files=await manager.local.list();assert.ok(files.some(file=>file.name.includes('przed przywróceniem')));}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('backup settings require at least one destination',()=>{
  const{root,manager}=fixture();
  try{assert.throws(()=>manager.updateSettings({local_enabled:false,drive_enabled:false,interval_hours:24}),/co najmniej jedno/);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('missing Google Drive folder is recreated automatically',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cresci-drive-folder-test-')),tokenPath=path.join(root,'token.json'),calls=[];
  fs.writeFileSync(tokenPath,JSON.stringify({refresh_token:'refresh',access_token:'access',expires_at:Date.now()+600_000,folder_id:'missing-folder'}));
  const fetchImpl=async(url,options={})=>{calls.push({url,method:options.method||'GET'});if(url.includes('/files/missing-folder'))return new Response(JSON.stringify({error:{message:'File not found'}}),{status:404,headers:{'Content-Type':'application/json'}});if(options.method==='POST'&&url.includes('/drive/v3/files?'))return new Response(JSON.stringify({id:'new-folder',name:'CRESCI Backups'}),{status:200,headers:{'Content-Type':'application/json'}});throw new Error(`Unexpected request: ${url}`);};
  try{const provider=new GoogleDriveProvider({tokenPath,clientId:'client',clientSecret:'secret',fetchImpl});const folderId=await provider.ensureFolder('access');assert.equal(folderId,'new-folder');assert.equal(provider.readToken().folder_id,'new-folder');assert.deepEqual(calls.map(call=>call.method),['GET','POST']);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});
