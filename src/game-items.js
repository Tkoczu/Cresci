export const ITEM_SLOTS = Object.freeze(['top','bottom','shoes','headwear','accessories']);

export const SLOT_LABELS = Object.freeze({
  top:'Góra',bottom:'Dół',shoes:'Buty',headwear:'Nakrycie głowy',accessories:'Akcesoria'
});

export const RARITY_LABELS = Object.freeze({common:'Zwykły',rare:'Rzadki',epic:'Epicki',legendary:'Legendarny'});

export const GAME_ITEMS = Object.freeze([
  {key:'cresci_tank',name:'Top CRESCI',slot:'top',spriteName:'cresci_training_top',rarity:'common',pricePr:2,description:'Klasyczny treningowy top w stylistyce CRESCI.'},
  {key:'black_tee',name:'Czarny T-shirt',slot:'top',rarity:'common',pricePr:3,description:'Prosty czarny T-shirt do ciężkich treningów.'},
  {key:'orange_hoodie',name:'Pomarańczowa bluza',slot:'top',rarity:'rare',pricePr:6,description:'Bluza z mocnym pomarańczowym akcentem CRESCI.'},
  {key:'power_crop',name:'Power Crop',slot:'top',rarity:'epic',pricePr:10,description:'Epicka góra stroju w stylu retro fitness RPG.'},

  {key:'training_shorts',name:'Szorty treningowe',slot:'bottom',spriteName:'cresci_training_bottom',rarity:'common',pricePr:2,description:'Lekkie szorty do codziennego treningu.'},
  {key:'leggings',name:'Legginsy',slot:'bottom',rarity:'common',pricePr:3,description:'Elastyczny dół stroju treningowego.'},
  {key:'cargo_shorts',name:'Szorty cargo',slot:'bottom',rarity:'rare',pricePr:6,description:'Retro szorty z bojowym charakterem.'},
  {key:'power_joggers',name:'Power Joggers',slot:'bottom',rarity:'epic',pricePr:10,description:'Epickie joggery dla rozwijanej postaci.'},

  {key:'trainers',name:'Buty treningowe',slot:'shoes',spriteName:'cresci_runners',rarity:'common',pricePr:2,description:'Uniwersalne buty na każdy trening.'},
  {key:'high_tops',name:'Buty wysokie',slot:'shoes',rarity:'common',pricePr:3,description:'Wysokie buty w stylu retro.'},
  {key:'orange_lifters',name:'Orange Lifters',slot:'shoes',rarity:'rare',pricePr:7,description:'Stabilne buty z pomarańczowym detalem.'},
  {key:'legend_lifters',name:'Legend Lifters',slot:'shoes',rarity:'legendary',pricePr:15,description:'Legendarne obuwie dla mistrza CRESCI.'},

  {key:'headband',name:'Opaska',slot:'headwear',rarity:'common',pricePr:2,description:'Klasyczna opaska treningowa.'},
  {key:'cap',name:'Czapka CRESCI',slot:'headwear',spriteName:'cresci_cap',rarity:'common',pricePr:3,description:'Czapka z daszkiem w czarno-pomarańczowym stylu.'},
  {key:'beanie',name:'Beanie',slot:'headwear',rarity:'rare',pricePr:6,description:'Czapka typu beanie do miejskiego zestawu.'},
  {key:'champion_bandana',name:'Bandana czempiona',slot:'headwear',rarity:'epic',pricePr:10,description:'Bandana dla postaci, która nie odpuszcza.'},

  {key:'wrist_wraps',name:'Owijki na nadgarstki',slot:'accessories',spriteName:'cresci_wristbands',rarity:'common',pricePr:2,description:'Owijki przygotowane pod mocne wyciskanie.'},
  {key:'lifting_belt',name:'Pas treningowy',slot:'accessories',rarity:'rare',pricePr:6,description:'Pas do ciężkich bojów.'},
  {key:'gym_chain',name:'Łańcuch siłacza',slot:'accessories',rarity:'epic',pricePr:10,description:'Pixelowy łańcuch dla rozwiniętej postaci.'},
  {key:'golden_shaker',name:'Złoty shaker',slot:'accessories',rarity:'legendary',pricePr:15,description:'Legendarny symbol kolekcjonera CRESCI.'}
]);

const itemMap=new Map(GAME_ITEMS.map(item=>[item.key,item]));
export function gameItem(key){return itemMap.get(String(key))||null;}

export function avatarFieldForSlot(slot){return{top:'top_style',bottom:'bottom_style',shoes:'shoes_style',headwear:'headwear',accessories:'accessory'}[slot]||slot;}

export function avatarItems(avatar){
  return ITEM_SLOTS.map(slot=>({slot,key:avatar?.[avatarFieldForSlot(slot)]})).filter(item=>item.key&&item.key!=='none'&&gameItem(item.key));
}
