import { readFileSync } from 'node:fs';

export const ACHIEVEMENTS = Object.freeze([
  {key:'first_step',category:'training',name:'Pierwszy krok',description:'Zamelduj się po raz pierwszy.',metric:'check_ins',target:1,rewardPr:1},
  {key:'getting_started',category:'training',name:'Rozkręcamy się',description:'Zapisz 10 meldunków.',metric:'check_ins',target:10,rewardPr:2},
  {key:'regular',category:'training',name:'Bywalec',description:'Zapisz 25 meldunków.',metric:'check_ins',target:25,rewardPr:3},
  {key:'veteran',category:'training',name:'Weteran',description:'Zapisz 50 meldunków.',metric:'check_ins',target:50,rewardPr:5},
  {key:'iron_hundred',category:'training',name:'Żelazna setka',description:'Zapisz 100 meldunków.',metric:'check_ins',target:100,rewardPr:10},
  {key:'gym_legend',category:'training',name:'Legenda siłowni',description:'Zapisz 250 meldunków.',metric:'check_ins',target:250,rewardPr:20},

  {key:'level_up',category:'progress',name:'Level Up!',description:'Zdobądź PR za pierwszy rekord ciężaru.',metric:'records',target:1,rewardPr:1},
  {key:'stronger_than_yesterday',category:'progress',name:'Silniejszy niż wczoraj',description:'Zdobądź PR za 10 rekordów.',metric:'records',target:10,rewardPr:3},
  {key:'final_form',category:'progress',name:'To nawet nie jest moja finalna forma',description:'Popraw rekord 5 razy w jednym ćwiczeniu.',metric:'records_single_exercise',target:5,rewardPr:4},
  {key:'limit_breaker',category:'progress',name:'Limit Breaker',description:'Zdobądź PR za 50 rekordów.',metric:'records',target:50,rewardPr:8},
  {key:'pr_machine',category:'progress',name:'PR Machine',description:'Zdobądź PR za 100 rekordów.',metric:'records',target:100,rewardPr:15},

  {key:'on_fire',category:'regularity',name:'On Fire',description:'Zrealizuj tygodniowy cel przez 2 kolejne tygodnie.',metric:'weekly_streak',target:2,rewardPr:2},
  {key:'no_excuses',category:'regularity',name:'Nie ma wymówek',description:'Zrealizuj tygodniowy cel przez 4 kolejne tygodnie.',metric:'weekly_streak',target:4,rewardPr:3},
  {key:'momentum',category:'regularity',name:'Momentum',description:'Zrealizuj tygodniowy cel przez 8 kolejnych tygodni.',metric:'weekly_streak',target:8,rewardPr:5},
  {key:'unstoppable',category:'regularity',name:'Unstoppable',description:'Zrealizuj tygodniowy cel przez 12 kolejnych tygodni.',metric:'weekly_streak',target:12,rewardPr:7},
  {key:'disciplina',category:'regularity',name:'Disciplina',description:'Zrealizuj tygodniowy cel przez 26 kolejnych tygodni.',metric:'weekly_streak',target:26,rewardPr:12},
  {key:'year_of_cresci',category:'regularity',name:'Rok CRESCI',description:'Zrealizuj tygodniowy cel przez 52 kolejne tygodnie.',metric:'weekly_streak',target:52,rewardPr:20},

  {key:'experimenter',category:'exploration',name:'Eksperymentator',description:'Dodaj własne ćwiczenie.',metric:'custom_exercises',target:1,rewardPr:1},
  {key:'explorer',category:'exploration',name:'Odkrywca',description:'Zapisz wyniki w 20 różnych ćwiczeniach.',metric:'distinct_exercises',target:20,rewardPr:3},
  {key:'analyst',category:'exploration',name:'Analityk',description:'Otwórz pierwszy wykres progresu.',metric:'chart_views',target:1,rewardPr:1},
  {key:'chronicler',category:'exploration',name:'Kronikarz',description:'Zapisz 100 wyników.',metric:'saved_results',target:100,rewardPr:4},
  {key:'collector',category:'exploration',name:'Kolekcjoner',description:'Zdobądź pierwszy item.',metric:'items_acquired',target:1,rewardPr:1},
  {key:'first_purchase',category:'exploration',name:'Pierwszy zakup',description:'Kup pierwszy item za PR.',metric:'purchases',target:1,rewardPr:1},
  {key:'full_equipment',category:'exploration',name:'Pełny ekwipunek',description:'Zapełnij wszystkie sloty avatara.',metric:'full_equipment',target:1,rewardPr:5},

  {key:'night_warrior',category:'hidden',name:'Nocny wojownik',description:'Zamelduj się po 22:00.',metric:'night_check_ins',target:1,rewardPr:2,hidden:true},
  {key:'early_bird',category:'hidden',name:'Early Bird',description:'Zamelduj się przed 6:00.',metric:'early_check_ins',target:1,rewardPr:2,hidden:true},
  {key:'still_alive',category:'hidden',name:'Still Alive',description:'Zamelduj się po przerwie trwającej co najmniej 30 dni.',metric:'comeback_check_ins',target:1,rewardPr:3,hidden:true},
  {key:'saver',category:'hidden',name:'Sknera',description:'Osiągnij saldo co najmniej 50 PR.',metric:'pr_balance',target:50,rewardPr:5,hidden:true},
  {key:'shopaholic',category:'hidden',name:'Zakupoholik',description:'Kup 10 itemów.',metric:'purchases',target:10,rewardPr:4,hidden:true}
]);

export const ACHIEVEMENT_CATEGORIES = Object.freeze({training:'Trening',progress:'Progres',regularity:'Regularność',exploration:'Eksploracja',hidden:'Ukryte'});

export const ACHIEVEMENT_METRICS=new Set(['check_ins','records','records_single_exercise','max_record_weight','weekly_streak','custom_exercises','distinct_exercises','chart_views','saved_results','items_acquired','purchases','full_equipment','night_check_ins','early_check_ins','comeback_check_ins','pr_balance','level','achievements_unlocked']);
export const ACHIEVEMENT_CONDITION_TYPES=new Set(['metric_threshold','weight_record','record_count','check_in_count','level_reached','achievement_count','all_achievements','category_all','achievement_set']);
const CATALOG_URL=new URL('../public/content/achievements.json',import.meta.url);

export function achievementCatalog(options={}){
  try{
    const parsed=JSON.parse(readFileSync(CATALOG_URL,'utf8'));
    if(!Array.isArray(parsed?.items))throw new Error('items is not an array');
    const keys=new Set(),items=[];
    for(const raw of parsed.items){
      const key=String(raw?.key||'');
      const target=Number(raw?.target),rewardPr=Number(raw?.rewardPr||0);
      const conditionType=String(raw?.conditionType||'metric_threshold');
      const metric=String(raw?.metric||'');
      if((raw?.active===false&&!options.includeHidden)||!/^[a-z][a-z0-9_]{2,63}$/.test(key)||keys.has(key)||!ACHIEVEMENT_CATEGORIES[raw?.category]||!ACHIEVEMENT_CONDITION_TYPES.has(conditionType)||!Number.isInteger(rewardPr)||rewardPr<0)continue;
      if(conditionType==='metric_threshold'&&!ACHIEVEMENT_METRICS.has(metric))continue;
      if(['metric_threshold','weight_record','record_count','check_in_count','level_reached','achievement_count'].includes(conditionType)&&(!Number.isFinite(target)||target<1))continue;
      keys.add(key);
      items.push(Object.freeze({key,category:raw.category,name:String(raw.name||key),description:String(raw.description||''),metric,target:Number.isFinite(target)?target:1,rewardPr,hidden:Boolean(raw.hidden),active:raw.active!==false,conditionType,conditionParams:raw.conditionParams&&typeof raw.conditionParams==='object'?raw.conditionParams:{},countsTowardCompletion:raw.countsTowardCompletion!==false,rewardItemKey:raw.rewardItemKey||null}));
    }
    return Object.freeze(items);
  }catch(error){
    console.error('Nie udało się odczytać katalogu achievementów; używam katalogu wbudowanego.',error.message);
    return ACHIEVEMENTS;
  }
}

function mondayUtc(dateText){const date=new Date(`${dateText}T00:00:00Z`),day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date;}

export function longestCompletedWeeklyStreak(dateTexts,weeklyGoal){
  const goal=Math.max(1,Math.min(7,Number(weeklyGoal)||3)),weeks=new Map();
  for(const text of new Set(dateTexts.filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))){const monday=mondayUtc(text),key=monday.toISOString().slice(0,10);weeks.set(key,(weeks.get(key)||0)+1);}
  const completed=[...weeks].filter(([,count])=>count>=goal).map(([key])=>mondayUtc(key).getTime()).sort((a,b)=>a-b);
  let longest=0,current=0,previous=null;
  for(const week of completed){current=previous!==null&&week-previous===7*86400000?current+1:1;longest=Math.max(longest,current);previous=week;}
  return longest;
}

export function achievementProgress(definition,metrics,context={}){
  const type=definition.conditionType||'metric_threshold',unlocked=context.unlocked||new Set(),catalog=context.catalog||[];
  let value=0,target=Math.max(1,Number(definition.target)||1),complete=false;
  if(type==='all_achievements'){
    const required=catalog.filter(item=>item.key!==definition.key&&item.active!==false&&item.countsTowardCompletion!==false);
    value=required.filter(item=>unlocked.has(item.key)).length;target=required.length;complete=target>0&&value>=target;
  }else if(type==='category_all'){
    const category=String(definition.conditionParams?.category||'');
    const required=catalog.filter(item=>item.key!==definition.key&&item.active!==false&&item.category===category&&item.countsTowardCompletion!==false);
    value=required.filter(item=>unlocked.has(item.key)).length;target=required.length;complete=target>0&&value>=target;
  }else if(type==='achievement_set'){
    const required=[...new Set((definition.conditionParams?.achievementKeys||[]).map(String))].filter(key=>key!==definition.key);
    value=required.filter(key=>unlocked.has(key)).length;target=required.length;complete=target>0&&value>=target;
  }else{
    const metric={weight_record:'max_record_weight',record_count:'records',check_in_count:'check_ins',level_reached:'level',achievement_count:'achievements_unlocked'}[type]||definition.metric;
    value=Math.max(0,Number(metrics[metric])||0);complete=value>=target;
  }
  return{value,target,complete,percent:target?Math.min(100,Math.round(value/target*100)):0};
}
