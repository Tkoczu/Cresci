const RELEASES_API='https://api.github.com/repos/Tkoczu/Cresci/releases/latest';

export function normalizeVersion(value){
  const match=String(value||'').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  if(!match)throw new Error(`Nieprawidłowy numer wersji: ${value||'brak'}.`);
  return{raw:String(value).trim(),normalized:`${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,parts:match.slice(1,4).map(Number)};
}

export function compareVersions(current,latest){
  const a=normalizeVersion(current).parts,b=normalizeVersion(latest).parts;
  for(let index=0;index<3;index++)if(a[index]!==b[index])return a[index]<b[index]?-1:1;
  return 0;
}

export class GitHubReleaseChecker{
  constructor({currentVersion,fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
    this.currentVersion=normalizeVersion(currentVersion).normalized;
    this.fetchImpl=fetchImpl;
    this.timeoutMs=timeoutMs;
  }

  versionInfo(){
    return{current_version:this.currentVersion,repository:'Tkoczu/Cresci',release_source:'github-releases',install_mode:'lxc-systemd-helper',install_command:'sudo cresci update'};
  }

  async check(){
    let response;
    try{
      response=await this.fetchImpl(RELEASES_API,{headers:{Accept:'application/vnd.github+json','User-Agent':`CRESCI/${this.currentVersion}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(this.timeoutMs)});
    }catch(error){
      throw new Error(error?.name==='TimeoutError'?'GitHub nie odpowiedział w wyznaczonym czasie.':'Nie udało się połączyć z GitHub Releases.');
    }
    if(response.status===404)return{...this.versionInfo(),latest_version:null,latest_tag:null,title:null,changelog:null,release_url:null,published_at:null,update_available:false,no_public_release:true};
    if(!response.ok)throw new Error(response.status===403?'GitHub chwilowo ograniczył liczbę zapytań. Spróbuj ponownie później.':`GitHub Releases zwrócił błąd ${response.status}.`);
    const release=await response.json(),tag=String(release.tag_name||'').trim(),latest=normalizeVersion(tag).normalized;
    return{...this.versionInfo(),latest_version:latest,latest_tag:tag,title:String(release.name||tag),changelog:String(release.body||'Brak opisu wydania.'),release_url:String(release.html_url||''),published_at:release.published_at||null,update_available:compareVersions(this.currentVersion,latest)<0,no_public_release:false};
  }
}
