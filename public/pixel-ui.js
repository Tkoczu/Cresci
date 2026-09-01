// PIXEL UI — wymienna warstwa prezentacji. Nie zawiera logiki biznesowej ani własnego stanu danych.
export const UI_MODE_KEY='cresci-ui-mode';

export function normalizeUiMode(value){return value==='pixel'?'pixel':'classic';}

export function storedUiMode(storage=localStorage){
  try{return normalizeUiMode(storage.getItem(UI_MODE_KEY));}
  catch{return 'classic';}
}

export function persistUiMode(mode,storage=localStorage){
  const normalized=normalizeUiMode(mode);
  try{storage.setItem(UI_MODE_KEY,normalized);}catch{}
  return normalized;
}

export function calculateTrainingStreak(rows=[]){
  const days=[...new Set(rows.map(row=>row.performed_at).filter(Boolean))].sort().reverse();
  if(!days.length)return 0;
  let streak=1;
  for(let index=1;index<days.length;index++){
    const newer=new Date(`${days[index-1]}T12:00:00`),older=new Date(`${days[index]}T12:00:00`);
    const gap=Math.round((newer-older)/86400000);
    if(gap>7)break;
    streak+=1;
  }
  return streak;
}

export function recordRows(rows=[]){
  const records=new Map();
  for(const row of rows){
    const weight=Number(row.new_weight);
    if(!Number.isFinite(weight))continue;
    const current=records.get(row.exercise_id);
    if(!current||weight>Number(current.new_weight))records.set(row.exercise_id,row);
  }
  return [...records.values()].sort((a,b)=>Number(b.new_weight)-Number(a.new_weight));
}

export function pixelCharacterMarkup(item,{escape,spriteAvatar,slotSource}){
  const leftSlots=[['headwear','Czapka'],['top','Tors'],['bottom','Spodnie'],['shoes','Buty']];
  const rightSlots=[['back','Plecak'],['accessories','Akcesoria'],['hair','Fryzura'],['eyes','Oczy']];
  const slot=(layer,label)=>{
    const source=slotSource(layer,item);
    const editor=['hair','eyes'].includes(layer)?' data-avatar-appearance-part="true"':'';
    return `<button class="pixel-equip-slot" type="button" data-equipment-slot="${layer}" data-equipment-user="${item.user_id}"${editor} aria-label="Zmień: ${escape(label)}"><span>${escape(label)}</span><div>${source?`<img src="${escape(source)}" alt="" loading="lazy">`:'<i>—</i>'}</div></button>`;
  };
  return `<article class="character-card pixel-character-card" style="--profile-color:${escape(item.color)}">
    <header class="pixel-character-heading"><div><span>CRESCI GAME</span><h3>${escape(item.user_name)}</h3></div><strong>POZIOM ${item.level}</strong></header>
    <div class="pixel-character-layout">
      <div class="pixel-slots pixel-slots-left">${leftSlots.map(([layer,label])=>slot(layer,label)).join('')}</div>
      <div class="pixel-avatar-scene"><div class="pixel-scene-grid"></div>${spriteAvatar(item,'pixel-avatar-main')}</div>
      <div class="pixel-slots pixel-slots-right">${rightSlots.map(([layer,label])=>slot(layer,label)).join('')}</div>
      <aside class="pixel-character-stats"><h3>STATYSTYKI POSTACI</h3><dl><div><dt>Poziom</dt><dd>${item.level}</dd></div><div><dt>Do następnego poziomu</dt><dd>${item.required_xp-item.current_xp} XP</dd></div><div><dt>Całkowite XP</dt><dd>${item.total_xp}</dd></div><div><dt>PR</dt><dd>${item.pr_balance}</dd></div><div><dt>Łącznie zdobyte PR</dt><dd>${item.pr_total_earned}</dd></div></dl><div class="pixel-xp-track"><i style="width:${item.progress_percent}%"></i></div><small>${item.current_xp} / ${item.required_xp} XP</small></aside>
    </div>
    <div class="pixel-character-actions"><button class="primary" type="button" data-edit-avatar="${item.user_id}">EDYTUJ POSTAĆ</button><button class="secondary" type="button" data-game-check-in="${item.user_id}" ${item.checked_in_today?'disabled':''}>${item.checked_in_today?'✓ ZAMELDOWANO':`ZAMELDUJ SIĘ · +${item.check_in_xp} XP`}</button></div>
  </article>`;
}
