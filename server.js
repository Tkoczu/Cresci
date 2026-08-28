import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, createRepository } from './src/db.js';
import { searchWgerExercises } from './src/exercise-catalog.js';
import { BackupManager, GoogleDriveProvider } from './src/backup.js';
import { updateGoogleEnv } from './src/env-config.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(root,'.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const databasePath = path.resolve(root, process.env.DATABASE_PATH || './data/gym-progress.sqlite');
const db = openDatabase(databasePath);
const repo = createRepository(db);
const googleDrive = new GoogleDriveProvider({ tokenPath:path.resolve(root,'data/google-drive-token.json'), clientId:process.env.GOOGLE_CLIENT_ID, clientSecret:process.env.GOOGLE_CLIENT_SECRET });
const backups = new BackupManager({ exportData:()=>repo.exportData(), importData:payload=>repo.importData(payload), settingsPath:path.resolve(root,'data/backup-settings.json'), localDirectory:path.resolve(root,'backups/automatic'), googleDrive });

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.ico':'image/x-icon' };
const send = (res, status, body, type='application/json; charset=utf-8', headers={}) => {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options':'nosniff', ...headers });
  res.end(type.startsWith('application/json') && !Buffer.isBuffer(body) ? JSON.stringify(body) : body);
};
const bodyJson = req => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; if (raw.length > 10_000_000) reject(new Error('Plik jest zbyt duży.')); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Nieprawidłowy JSON.')); } });
  req.on('error', reject);
});
const positiveInt = value => Number.isInteger(Number(value)) && Number(value) > 0;
const redirectUriFor = (req, url) => process.env.GOOGLE_REDIRECT_URI || `${req.headers['x-forwarded-proto'] || url.protocol.replace(':','')}://${req.headers.host || `localhost:${port}`}/api/google-drive/callback`;
const redirect = (res, location) => { res.writeHead(302, { Location:location, 'Cache-Control':'no-store' }); res.end(); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/bootstrap') return send(res, 200, repo.bootstrap());
    if (req.method === 'GET' && url.pathname === '/api/history') return send(res, 200, repo.history({ profile_id:url.searchParams.get('profile_id'), exercise_id:url.searchParams.get('exercise_id') }));
    if (req.method === 'GET' && url.pathname === '/api/progress') {
      const profileId = url.searchParams.get('profile_id'); const exerciseId = url.searchParams.get('exercise_id');
      if (!positiveInt(profileId) || !positiveInt(exerciseId)) return send(res, 400, { error:'Wybierz osobę i ćwiczenie.' });
      return send(res, 200, repo.progress(Number(profileId), Number(exerciseId)));
    }
    if (req.method === 'GET' && url.pathname === '/api/overall-progress') {
      const profileId = url.searchParams.get('profile_id');
      if (profileId && !positiveInt(profileId)) return send(res, 400, { error:'Nieprawidłowy profil.' });
      return send(res, 200, repo.overallProgress(profileId ? Number(profileId) : null));
    }
    if (req.method === 'GET' && url.pathname === '/api/cresci-score') return send(res,200,repo.cresciScores());
    if (req.method === 'GET' && url.pathname === '/api/cresci-score/settings') return send(res,200,repo.scoreSettings());
    const scoreSettingsMatch=url.pathname.match(/^\/api\/cresci-score\/settings\/(\d+)$/);
    if(req.method==='PUT'&&scoreSettingsMatch){const userId=Number(scoreSettingsMatch[1]),input=await bodyJson(req);const updated=repo.updateScoreSettings(userId,input);return updated?send(res,200,updated):send(res,404,{error:'Nie znaleziono użytkownika.'});}
    if (req.method === 'GET' && url.pathname === '/api/cresci-game') return send(res,200,repo.gameStates());
    if (req.method === 'GET' && url.pathname === '/api/cresci-game/settings') return send(res,200,repo.gameSettings());
    const gameSettingsMatch=url.pathname.match(/^\/api\/cresci-game\/settings\/(\d+)$/);
    if(req.method==='PUT'&&gameSettingsMatch){const userId=Number(gameSettingsMatch[1]),input=await bodyJson(req);const updated=repo.updateGameSettings(userId,input);return updated?send(res,200,updated):send(res,404,{error:'Nie znaleziono użytkownika.'});}
    const gameCheckInMatch=url.pathname.match(/^\/api\/cresci-game\/check-in\/(\d+)$/);
    if(req.method==='POST'&&gameCheckInMatch){const result=repo.gameCheckIn(Number(gameCheckInMatch[1]));return send(res,201,result);}
    if(req.method==='GET'&&url.pathname==='/api/cresci-game/achievements'){
      const userId=url.searchParams.get('user_id');if(!positiveInt(userId))return send(res,400,{error:'Wybierz użytkownika.'});
      const result=repo.achievements(Number(userId));return result?send(res,200,result):send(res,404,{error:'CRESCI GAME nie jest włączony dla tego użytkownika.'});
    }
    if(req.method==='GET'&&url.pathname==='/api/cresci-game/inventory'){
      const userId=url.searchParams.get('user_id');if(!positiveInt(userId))return send(res,400,{error:'Wybierz użytkownika.'});
      const result=repo.inventory(Number(userId));return result?send(res,200,result):send(res,404,{error:'CRESCI GAME nie jest włączony dla tego użytkownika.'});
    }
    if(req.method==='GET'&&url.pathname==='/api/cresci-game/shop'){
      const userId=url.searchParams.get('user_id');if(!positiveInt(userId))return send(res,400,{error:'Wybierz użytkownika.'});
      const result=repo.shop(Number(userId));return result?send(res,200,result):send(res,404,{error:'CRESCI GAME nie jest włączony dla tego użytkownika.'});
    }
    const purchaseMatch=url.pathname.match(/^\/api\/cresci-game\/shop\/(\d+)\/purchase$/);
    if(req.method==='POST'&&purchaseMatch){const input=await bodyJson(req);return send(res,201,repo.purchaseItem(Number(purchaseMatch[1]),input.item_key));}
    const equipmentMatch=url.pathname.match(/^\/api\/cresci-game\/equipment\/(\d+)$/);
    if(req.method==='PUT'&&equipmentMatch){const input=await bodyJson(req);return send(res,200,repo.equipItem(Number(equipmentMatch[1]),input.slot,input.item_key||null));}
    const gameActionMatch=url.pathname.match(/^\/api\/cresci-game\/actions\/(\d+)$/);
    if(req.method==='POST'&&gameActionMatch){const input=await bodyJson(req);return send(res,200,repo.recordGameAction(Number(gameActionMatch[1]),input.action,input.details||{}));}
    if (req.method === 'GET' && url.pathname === '/api/catalog/exercises') {
      const query = (url.searchParams.get('q') || '').trim();
      if (query.length < 2 || query.length > 80) return send(res, 400, { error:'Wpisz od 2 do 80 znaków.' });
      try { return send(res, 200, await searchWgerExercises(query)); }
      catch (error) { return send(res, 502, { error:`Nie udało się pobrać katalogu wger. ${error.message}` }); }
    }
    if (req.method === 'POST' && url.pathname === '/api/exercises') {
      const input = await bodyJson(req);
      if (!input.name?.trim()) return send(res, 400, { error:'Nazwa ćwiczenia jest wymagana.' });
      return send(res, 201, repo.addExercise(input));
    }
    const exerciseMatch = url.pathname.match(/^\/api\/exercises\/(\d+)$/);
    if (req.method === 'PUT' && exerciseMatch) return send(res, 200, repo.updateExercise(Number(exerciseMatch[1]), await bodyJson(req)) || { error:'Nie znaleziono ćwiczenia.' });
    if (req.method === 'DELETE' && exerciseMatch) {const deleted=repo.deleteExercise(Number(exerciseMatch[1]));return deleted?send(res,200,{ok:true,...deleted}):send(res,404,{error:'Nie znaleziono ćwiczenia.'});}
    if (req.method === 'POST' && url.pathname === '/api/entries') {
      const input = await bodyJson(req);
      const hasWeight = input.new_weight !== undefined && input.new_weight !== null && String(input.new_weight).trim() !== '';
      if (!positiveInt(input.profile_id) || !positiveInt(input.exercise_id) || (hasWeight && (!Number.isFinite(Number(input.new_weight)) || Number(input.new_weight) < 0))) return send(res, 400, { error:'Uzupełnij osobę, ćwiczenie i — jeśli zmieniasz — poprawny ciężar.' });
      return send(res, 201, repo.addEntry(input));
    }
    const entryMatch = url.pathname.match(/^\/api\/entries\/(\d+)$/);
    if (req.method === 'PUT' && entryMatch) {
      const input = await bodyJson(req);
      if (!Number.isFinite(Number(input.new_weight)) || Number(input.new_weight) < 0) return send(res, 400, { error:'Podaj poprawny ciężar.' });
      const updated = repo.updateEntry(Number(entryMatch[1]), input);
      return updated ? send(res, 200, updated) : send(res, 404, { error:'Nie znaleziono wpisu.' });
    }
    if (req.method === 'DELETE' && entryMatch) return repo.deleteEntry(Number(entryMatch[1])) ? send(res, 200, { ok:true }) : send(res, 404, { error:'Nie znaleziono wpisu.' });
    if (req.method === 'GET' && url.pathname === '/api/export') {
      const stamp = new Date().toISOString().slice(0,10);
      return send(res, 200, repo.exportData(), 'application/json; charset=utf-8', { 'Content-Disposition':`attachment; filename="gym-progress-${stamp}.json"` });
    }
    if (req.method === 'POST' && url.pathname === '/api/import') return send(res, 200, { ok:true, imported:repo.importData(await bodyJson(req)) });
    if (req.method === 'GET' && url.pathname === '/api/backup/status') return send(res, 200, { ...backups.status(), redirect_uri:redirectUriFor(req,url) });
    if (req.method === 'POST' && url.pathname === '/api/google-drive/config') {
      const input=await bodyJson(req),clientId=input.client_id?.trim(),clientSecret=input.client_secret?.trim(),redirectUri=input.redirect_uri?.trim()||redirectUriFor(req,url);
      if(!clientId||(!clientSecret&&!googleDrive.clientSecret))return send(res,400,{error:'Wklej Client ID i Client Secret z Google Cloud.'});
      if(!clientId.endsWith('.apps.googleusercontent.com'))return send(res,400,{error:'Client ID powinien kończyć się na .apps.googleusercontent.com.'});
      if(!/^https?:\/\//.test(redirectUri))return send(res,400,{error:'Nieprawidłowy adres przekierowania OAuth.'});
      if(googleDrive.clientId&&googleDrive.clientId!==clientId&&googleDrive.status().connected)googleDrive.disconnect();
      updateGoogleEnv(envPath,{GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret||googleDrive.clientSecret,GOOGLE_REDIRECT_URI:redirectUri});
      process.env.GOOGLE_CLIENT_ID=clientId;process.env.GOOGLE_CLIENT_SECRET=clientSecret||googleDrive.clientSecret;process.env.GOOGLE_REDIRECT_URI=redirectUri;googleDrive.configure({clientId,clientSecret});
      return send(res,200,{ok:true,configured:true,redirect_uri:redirectUri});
    }
    if (req.method === 'PUT' && url.pathname === '/api/backup/settings') {
      const input=await bodyJson(req);
      if(input.drive_enabled&&!googleDrive.status().connected)return send(res,400,{error:'Najpierw połącz konto Google Drive.'});
      return send(res,200,backups.updateSettings(input));
    }
    if (req.method === 'POST' && url.pathname === '/api/backup/run') return send(res,200,await backups.run('manual'));
    if (req.method === 'GET' && url.pathname === '/api/backup/files') return send(res,200,await backups.listBackups());
    if (req.method === 'POST' && url.pathname === '/api/backup/restore') {const input=await bodyJson(req);if(!input.name?.trim())return send(res,400,{error:'Wybierz kopię do przywrócenia.'});return send(res,200,await backups.restore({name:input.name.trim(),drive_id:input.drive_id||null}));}
    if (req.method === 'GET' && url.pathname === '/api/google-drive/connect') return redirect(res,googleDrive.authorizationUrl(redirectUriFor(req,url)));
    if (req.method === 'GET' && url.pathname === '/api/google-drive/callback') {
      if(url.searchParams.get('error'))return redirect(res,'/?drive=cancelled');
      try{await googleDrive.finishAuthorization({code:url.searchParams.get('code'),state:url.searchParams.get('state')});return redirect(res,'/?drive=connected');}
      catch(error){console.error(`Google OAuth: ${error.message}`);return redirect(res,'/?drive=error');}
    }
    if (req.method === 'DELETE' && url.pathname === '/api/google-drive/connection') { googleDrive.disconnect();const settings=backups.settings();if(settings.drive_enabled)backups.updateSettings({...settings,drive_enabled:false,local_enabled:true});return send(res,200,{ok:true}); }
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { status:'ok', database:path.basename(databasePath) });

    const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
    const file = path.resolve(root, 'public', relative);
    const publicRoot = path.resolve(root, 'public');
    if (!file.startsWith(publicRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, { error:'Nie znaleziono.' });
    return send(res, 200, fs.readFileSync(file), mime[path.extname(file)] || 'application/octet-stream');
  } catch (error) {
    const status = /UNIQUE constraint/.test(error.message) ? 409 : 400;
    return send(res, status, { error: status === 409 ? 'Ćwiczenie o tej nazwie już istnieje.' : error.message || 'Wystąpił błąd.' });
  }
});

server.listen(port, host, () => { backups.start(); console.log(`Gym Progress: http://localhost:${port}`); });

function shutdown() { backups.stop();server.close(() => { db.close(); process.exit(0); }); server.closeAllConnections(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
