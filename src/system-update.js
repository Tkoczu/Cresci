import fs from 'node:fs';
import { execFile } from 'node:child_process';

const APP_ROOT='/opt/cresci';
const UPDATER='/opt/cresci/scripts/update.sh';
const STATUS_FILE='/var/lib/cresci-updater/status.json';
const SUDO='/usr/bin/sudo';
const SYSTEMCTL='/usr/bin/systemctl';
const UPDATE_UNIT='cresci-update.service';
const RUNNING_STATES=new Set(['queued','running']);

export class SystemUpdateError extends Error{
  constructor(message,statusCode=500){super(message);this.name='SystemUpdateError';this.statusCode=statusCode;}
}

function runUpdateUnit(){
  return new Promise((resolve,reject)=>{
    execFile(SUDO,[SYSTEMCTL,'start','--no-block',UPDATE_UNIT],{timeout:5000,windowsHide:true},(error,stdout,stderr)=>{
      if(error)return reject(new Error(String(stderr||stdout||error.message).trim()));
      resolve();
    });
  });
}

export class SystemUpdateManager{
  constructor({
    appRoot=APP_ROOT,
    updaterPath=UPDATER,
    statusFile=STATUS_FILE,
    env=process.env,
    platform=process.platform,
    uid=typeof process.getuid==='function'?process.getuid():null,
    fsImpl=fs,
    runCommand=runUpdateUnit,
    now=()=>Date.now()
  }={}){
    this.appRoot=String(appRoot).replace(/\/+$/,'');this.updaterPath=updaterPath;this.statusFile=statusFile;this.env=env;
    this.platform=platform;this.uid=uid;this.fs=fsImpl;this.runCommand=runCommand;this.now=now;
    this.requestedAt=0;this.requestedTarget=null;
  }

  availability(){
    if(this.platform!=='linux'||this.env.NODE_ENV!=='production'||this.env.CRESCI_UPDATE_ENABLED!=='1'||this.appRoot!==APP_ROOT){
      return{available:false,reason:'Instalacja aktualizacji jest dostępna tylko w produkcyjnej instalacji CRESCI LXC w /opt/cresci.'};
    }
    if(this.uid===0)return{available:false,reason:'Usługa CRESCI nie może działać jako root. Uruchom instalator ograniczonego helpera aktualizacji.'};
    try{
      const stat=this.fs.statSync(this.updaterPath);
      if(!stat.isFile())throw new Error('not-file');
      this.fs.accessSync(this.updaterPath,fs.constants.X_OK);
    }catch{
      return{available:false,reason:'Updater /opt/cresci/scripts/update.sh nie istnieje albo nie ma prawa wykonywania.'};
    }
    return{available:true,reason:null};
  }

  readDiskStatus(){
    try{
      const value=JSON.parse(this.fs.readFileSync(this.statusFile,'utf8'));
      return value&&typeof value==='object'?value:null;
    }catch{return null;}
  }

  status(){
    const availability=this.availability(),disk=this.readDiskStatus();
    const diskTime=Date.parse(disk?.updated_at||'');
    if(!this.requestedAt&&RUNNING_STATES.has(disk?.state)&&Number.isFinite(diskTime)&&this.now()-diskTime>15*60*1000){
      return{...availability,...disk,state:'failed',message:'Poprzednia aktualizacja nie zgłasza postępu od ponad 15 minut. Sprawdź usługę cresci-update.service.',rollback_succeeded:null};
    }
    if(this.requestedAt){
      if(Number.isFinite(diskTime)&&diskTime>=this.requestedAt-1000){
        if(!RUNNING_STATES.has(disk.state)){this.requestedAt=0;this.requestedTarget=null;}
        return{...disk,...availability};
      }
      if(this.now()-this.requestedAt>30000){
        this.requestedAt=0;this.requestedTarget=null;
        return{...availability,state:'failed',stage:'start',message:'Helper aktualizacji nie zgłosił rozpoczęcia. Sprawdź usługę cresci-update.service.',rollback_succeeded:null};
      }
      return{...availability,state:'queued',stage:'queued',message:'Aktualizacja została przekazana do bezpiecznego helpera.',target_version:this.requestedTarget,rollback_succeeded:null};
    }
    return{...availability,...(disk||{state:'idle',stage:'idle',message:availability.available?'Aktualizator jest gotowy.':availability.reason,rollback_succeeded:null})};
  }

  async start({targetVersion}={}){
    const availability=this.availability();
    if(!availability.available)throw new SystemUpdateError(availability.reason,409);
    const current=this.status();
    if(RUNNING_STATES.has(current.state))throw new SystemUpdateError('Aktualizacja CRESCI jest już uruchomiona.',409);
    this.requestedAt=this.now();this.requestedTarget=String(targetVersion||'');
    try{await this.runCommand();}
    catch(error){this.requestedAt=0;this.requestedTarget=null;throw new SystemUpdateError(`Nie udało się uruchomić ograniczonego helpera aktualizacji. ${error.message}`,500);}
    return this.status();
  }
}

export const systemUpdateConstants=Object.freeze({APP_ROOT,UPDATER,STATUS_FILE,SUDO,SYSTEMCTL,UPDATE_UNIT});
