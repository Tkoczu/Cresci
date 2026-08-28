const DAY_MS = 86_400_000;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const round = value => Math.round(value);

function dateMs(value){return Date.parse(`${value}T00:00:00Z`);}
function isoDay(ms){return new Date(ms).toISOString().slice(0,10);}
function addDays(value,days){return isoDay(dateMs(value)+days*DAY_MS);}
function dayDistance(a,b){return Math.round((dateMs(b)-dateMs(a))/DAY_MS);}

function periodScore({entries,activeExerciseIds,weeklyGoal,start,end}){
  const periodEntries=entries.filter(entry=>entry.performed_at>=start&&entry.performed_at<=end);
  const trainingDays=[...new Set(periodEntries.map(entry=>entry.performed_at))].sort();
  const byExercise=new Map();
  for(const entry of entries){if(!byExercise.has(entry.exercise_id))byExercise.set(entry.exercise_id,[]);byExercise.get(entry.exercise_id).push(entry);}
  for(const rows of byExercise.values())rows.sort((a,b)=>a.performed_at.localeCompare(b.performed_at)||Number(a.id||0)-Number(b.id||0));

  const changes=[];
  for(const exerciseId of activeExerciseIds){const rows=byExercise.get(exerciseId)||[],before=rows.filter(row=>row.performed_at<start).at(-1),inside=rows.filter(row=>row.performed_at>=start&&row.performed_at<=end);if(!inside.length)continue;const first=before||inside[0],last=inside.at(-1);if(Number(first.new_weight)<=0||(!before&&inside.length<2))continue;const raw=(Number(last.new_weight)-Number(first.new_weight))/Number(first.new_weight)*100;changes.push({exercise_id:exerciseId,raw_percent:raw,capped_percent:clamp(raw,-10,10),progressed:Number(last.new_weight)>Number(first.new_weight)});}

  const averageChange=changes.length?changes.reduce((sum,item)=>sum+item.capped_percent,0)/changes.length:0;
  const strength=trainingDays.length?(changes.length?round(clamp(20+averageChange*2,0,40)):20):0;
  const targetDays=weeklyGoal*30/7,regularity=round(clamp(trainingDays.length/targetDays,0,1)*25);
  const progressedExercises=changes.filter(item=>item.progressed).length;
  const coverage=activeExerciseIds.length?round(progressedExercises/activeExerciseIds.length*20):0;

  let longestGap=30,continuity=0;
  if(trainingDays.length){const gaps=[dayDistance(start,trainingDays[0]),dayDistance(trainingDays.at(-1),end)];for(let i=1;i<trainingDays.length;i++)gaps.push(dayDistance(trainingDays[i-1],trainingDays[i]));longestGap=Math.max(...gaps);const expectedGap=Math.ceil(7/weeklyGoal),fullScoreGap=expectedGap+2,zeroScoreGap=Math.max(14,fullScoreGap+7);continuity=longestGap<=fullScoreGap?15:round(15*clamp(1-(longestGap-fullScoreGap)/(zeroScoreGap-fullScoreGap),0,1));}

  return{
    score:strength+regularity+coverage+continuity,
    training_days:trainingDays.length,
    categories:{
      strength:{score:strength,max:40,label:'Progres siłowy',average_capped_change_percent:Math.round(averageChange*10)/10,comparable_exercises:changes.length},
      regularity:{score:regularity,max:25,label:'Regularność',weekly_goal:weeklyGoal,target_days:Math.round(targetDays*10)/10,training_days:trainingDays.length},
      coverage:{score:coverage,max:20,label:'Ćwiczenia z progresem',active_exercises:activeExerciseIds.length,progressed_exercises:progressedExercises},
      continuity:{score:continuity,max:15,label:'Ciągłość treningów',longest_gap_days:longestGap}
    }
  };
}

function explanation(current,previous){
  if(!current.training_days)return'W ostatnich 30 dniach nie ma zapisanych treningów, dlatego Score nie naliczył punktów.';
  const categoryKeys=['strength','regularity','coverage','continuity'],deltas=categoryKeys.map(key=>({key,delta:current.categories[key].score-previous.categories[key].score,label:current.categories[key].label})).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
  const lead=deltas[0];let first=lead.delta>0?`Największy wzrost daje ${lead.label.toLowerCase()} (+${lead.delta} pkt).`:lead.delta<0?`Największy spadek wynika z kategorii ${lead.label.toLowerCase()} (${lead.delta} pkt).`:'Wynik jest zbliżony do poprzednich 30 dni.';
  const regularity=current.categories.regularity,continuity=current.categories.continuity,strength=current.categories.strength;
  let second=regularity.score===regularity.max?`Cel ${regularity.weekly_goal} treningów tygodniowo został zrealizowany.`:`Zapisano ${regularity.training_days} dni treningowych przy celu ${regularity.weekly_goal} treningów tygodniowo.`;
  if(strength.average_capped_change_percent>0)second+=` Średnia ograniczona zmiana ciężaru to +${strength.average_capped_change_percent}%.`;
  else if(continuity.longest_gap_days>=10)second+=` Najdłuższa przerwa miała ${continuity.longest_gap_days} dni.`;
  return`${first} ${second}`;
}

export function calculateCresciScore({userId,userName,weeklyGoal=3,entries=[],activeExerciseIds=[],asOf=new Date().toISOString().slice(0,10)}){
  const goal=clamp(Math.round(Number(weeklyGoal)||3),1,7),currentStart=addDays(asOf,-29),previousEnd=addDays(asOf,-30),previousStart=addDays(asOf,-59);
  const normalizedEntries=entries.filter(entry=>Number(entry.profile_id??userId)===Number(userId)&&entry.performed_at<=asOf).map(entry=>({...entry,exercise_id:Number(entry.exercise_id),new_weight:Number(entry.new_weight)}));
  const exerciseIds=[...new Set(activeExerciseIds.map(Number))];
  const current=periodScore({entries:normalizedEntries,activeExerciseIds:exerciseIds,weeklyGoal:goal,start:currentStart,end:asOf});
  const previous=periodScore({entries:normalizedEntries,activeExerciseIds:exerciseIds,weeklyGoal:goal,start:previousStart,end:previousEnd});
  const categories={};for(const key of Object.keys(current.categories))categories[key]={...current.categories[key],previous_score:previous.categories[key].score,change:current.categories[key].score-previous.categories[key].score};
  return{version:1,user_id:Number(userId),user_name:userName,score:current.score,previous_score:previous.score,change:current.score-previous.score,direction:current.score>previous.score?'up':current.score<previous.score?'down':'same',period:{start:currentStart,end:asOf},previous_period:{start:previousStart,end:previousEnd},training_days:current.training_days,categories,explanation:explanation(current,previous),methodology:{strength:'20 pkt za utrzymanie; średnia procentowa zmiana ciężaru daje 0–40 pkt. Zmiana każdego ćwiczenia jest ograniczana do ±10%.',regularity:'Dni treningowe względem celu treningów na tydzień, proporcjonalnie do 30 dni.',coverage:'Odsetek aktywnych ćwiczeń użytkownika, w których końcowy ciężar wzrósł.',continuity:'Punkty zależą od najdłuższej przerwy między treningami i celu tygodniowego.'}};
}

export const scoreDateHelpers={addDays};
