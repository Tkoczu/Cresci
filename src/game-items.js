import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ITEM_SLOTS = Object.freeze(['back','top','bottom','shoes','headwear','accessories']);

export const SLOT_LABELS = Object.freeze({
  back:'Plecy',top:'Góra',bottom:'Dół',shoes:'Buty',headwear:'Nakrycie głowy',accessories:'Akcesoria'
});

export const RARITY_LABELS = Object.freeze({common:'Zwykły',rare:'Rzadki',epic:'Epicki',legendary:'Legendarny'});

const BUILTIN_GAME_ITEMS = [
  {key:'cresci_tank',name:'Top CRESCI',slot:'top',spriteName:'cresci_training_top',rarity:'common',pricePr:2,description:'Klasyczny treningowy top w stylistyce CRESCI.'},
  {key:'black_tee',name:'Czarny T-shirt',slot:'top',rarity:'common',pricePr:3,description:'Prosty czarny T-shirt do ciężkich treningów.'},
  {key:'orange_hoodie',name:'Pomarańczowa bluza',slot:'top',spriteName:'orange_pullover_hoodie',collection:'CRESCI Core',rarity:'rare',pricePr:6,description:'Bluza z mocnym pomarańczowym akcentem CRESCI.'},
  {key:'power_crop',name:'Power Crop',slot:'top',spriteName:'black_performance_tank',collection:'CRESCI Core',rarity:'epic',pricePr:10,description:'Epicka góra stroju w stylu retro fitness RPG.'},

  {key:'training_shorts',name:'Szorty treningowe',slot:'bottom',spriteName:'cresci_training_bottom',rarity:'common',pricePr:2,description:'Lekkie szorty do codziennego treningu.'},
  {key:'leggings',name:'Legginsy',slot:'bottom',rarity:'common',pricePr:3,description:'Elastyczny dół stroju treningowego.'},
  {key:'cargo_shorts',name:'Cargo moro',slot:'bottom',spriteName:'camo_cargo_pants',collection:'CRESCI Core',rarity:'rare',pricePr:6,description:'Retro spodnie cargo z bojowym charakterem.'},
  {key:'power_joggers',name:'Power Joggers',slot:'bottom',spriteName:'black_elite_joggers',collection:'CRESCI Core',rarity:'epic',pricePr:10,description:'Epickie joggery dla rozwijanej postaci.'},

  {key:'trainers',name:'Buty treningowe',slot:'shoes',spriteName:'cresci_runners',rarity:'common',pricePr:2,description:'Uniwersalne buty na każdy trening.'},
  {key:'high_tops',name:'Buty wysokie Shadow',slot:'shoes',spriteName:'black_shadow_hightops',collection:'CRESCI Core',rarity:'common',pricePr:3,description:'Wysokie buty w stylu retro.'},
  {key:'orange_lifters',name:'Orange Lifters',slot:'shoes',spriteName:'orange_utility_boots',collection:'CRESCI Core',rarity:'rare',pricePr:7,description:'Stabilne buty z pomarańczowym detalem.'},
  {key:'legend_lifters',name:'Legend Lifters',slot:'shoes',rarity:'legendary',pricePr:15,description:'Legendarne obuwie dla mistrza CRESCI.'},

  {key:'headband',name:'Opaska',slot:'headwear',rarity:'common',pricePr:2,description:'Klasyczna opaska treningowa.'},
  {key:'cap',name:'Czapka CRESCI',slot:'headwear',spriteName:'cresci_cap',rarity:'common',pricePr:3,description:'Czapka z daszkiem w czarno-pomarańczowym stylu.'},
  {key:'beanie',name:'Czerwona czapka beanie',slot:'headwear',spriteName:'red_knit_beanie',collection:'CRESCI Core',rarity:'rare',pricePr:6,description:'Czapka typu beanie do miejskiego zestawu.'},
  {key:'champion_bandana',name:'Bandana czempiona',slot:'headwear',rarity:'epic',pricePr:10,description:'Bandana dla postaci, która nie odpuszcza.'},

  {key:'wrist_wraps',name:'Owijki na nadgarstki',slot:'accessories',spriteName:'cresci_wristbands',rarity:'common',pricePr:2,description:'Owijki przygotowane pod mocne wyciskanie.'},
  {key:'lifting_belt',name:'Pas treningowy',slot:'accessories',spriteName:'black_utility_belt',collection:'CRESCI Core',rarity:'rare',pricePr:6,description:'Pas do ciężkich bojów.'},
  {key:'gym_chain',name:'Złoty łańcuch siłacza',slot:'accessories',spriteName:'gold_power_chain',collection:'CRESCI Core',rarity:'epic',pricePr:10,description:'Pixelowy łańcuch dla rozwiniętej postaci.'},
  {key:'golden_shaker',name:'Złoty shaker',slot:'accessories',rarity:'legendary',pricePr:15,description:'Legendarny symbol kolekcjonera CRESCI.'},

  {key:'ember_elite_top',name:'Ember Elite — góra',slot:'top',spriteName:'ember_elite_top',collection:'Ember Elite',rarity:'rare',pricePr:7,description:'Góra rzadkiego zestawu Ember Elite.'},
  {key:'ember_elite_bottom',name:'Ember Elite — dół',slot:'bottom',spriteName:'ember_elite_bottom',collection:'Ember Elite',rarity:'rare',pricePr:6,description:'Dół rzadkiego zestawu Ember Elite.'},
  {key:'ember_elite_shoes',name:'Ember Elite — buty',slot:'shoes',spriteName:'ember_elite_shoes',collection:'Ember Elite',rarity:'rare',pricePr:5,description:'Buty rzadkiego zestawu Ember Elite.'},
  {key:'ember_elite_headwear',name:'Ember Elite — nakrycie głowy',slot:'headwear',spriteName:'ember_elite_headwear',collection:'Ember Elite',rarity:'rare',pricePr:4,description:'Nakrycie głowy rzadkiego zestawu Ember Elite.'},
  {key:'ember_elite_accessories',name:'Ember Elite — akcesoria',slot:'accessories',spriteName:'ember_elite_accessories',collection:'Ember Elite',rarity:'rare',pricePr:3,description:'Akcesoria rzadkiego zestawu Ember Elite.'},

  {key:'neon_night_top',name:'Neon Night — góra',slot:'top',spriteName:'neon_night_top',collection:'Neon Night',rarity:'epic',pricePr:10,description:'Góra epickiego zestawu Neon Night.'},
  {key:'neon_night_bottom',name:'Neon Night — dół',slot:'bottom',spriteName:'neon_night_bottom',collection:'Neon Night',rarity:'epic',pricePr:9,description:'Dół epickiego zestawu Neon Night.'},
  {key:'neon_night_shoes',name:'Neon Night — buty',slot:'shoes',spriteName:'neon_night_shoes',collection:'Neon Night',rarity:'epic',pricePr:8,description:'Buty epickiego zestawu Neon Night.'},
  {key:'neon_night_headwear',name:'Neon Night — nakrycie głowy',slot:'headwear',spriteName:'neon_night_headwear',collection:'Neon Night',rarity:'epic',pricePr:7,description:'Nakrycie głowy epickiego zestawu Neon Night.'},
  {key:'neon_night_accessories',name:'Neon Night — akcesoria',slot:'accessories',spriteName:'neon_night_accessories',collection:'Neon Night',rarity:'epic',pricePr:6,description:'Akcesoria epickiego zestawu Neon Night.'},

  {key:'royal_crest_top',name:'Royal Crest — góra',slot:'top',spriteName:'royal_crest_top',collection:'Royal Crest',rarity:'legendary',pricePr:15,description:'Góra legendarnego zestawu Royal Crest.'},
  {key:'royal_crest_bottom',name:'Royal Crest — dół',slot:'bottom',spriteName:'royal_crest_bottom',collection:'Royal Crest',rarity:'legendary',pricePr:14,description:'Dół legendarnego zestawu Royal Crest.'},
  {key:'royal_crest_shoes',name:'Royal Crest — buty',slot:'shoes',spriteName:'royal_crest_shoes',collection:'Royal Crest',rarity:'legendary',pricePr:12,description:'Buty legendarnego zestawu Royal Crest.'},
  {key:'royal_crest_headwear',name:'Royal Crest — nakrycie głowy',slot:'headwear',spriteName:'royal_crest_headwear',collection:'Royal Crest',rarity:'legendary',pricePr:10,description:'Nakrycie głowy legendarnego zestawu Royal Crest.'},
  {key:'royal_crest_accessories',name:'Royal Crest — akcesoria',slot:'accessories',spriteName:'royal_crest_accessories',collection:'Royal Crest',rarity:'legendary',pricePr:8,description:'Akcesoria legendarnego zestawu Royal Crest.'},

  {key:'white_classic_cap',name:'Biała czapka Classic',slot:'headwear',spriteName:'white_classic_cap',collection:'CRESCI Core',rarity:'common',pricePr:5,description:'Klasyczna biała czapka treningowa.'},
  {key:'orange_training_tee',name:'Pomarańczowy T-shirt treningowy',slot:'top',spriteName:'orange_training_tee',collection:'CRESCI Core',rarity:'rare',pricePr:12,description:'Pomarańczowy T-shirt CRESCI.'},
  {key:'charcoal_zip_hoodie',name:'Grafitowa bluza na zamek',slot:'top',spriteName:'charcoal_zip_hoodie',collection:'CRESCI Core',rarity:'rare',pricePr:15,description:'Grafitowa bluza treningowa na zamek.'},
  {key:'red_pullover_hoodie',name:'Czerwona bluza',slot:'top',spriteName:'red_pullover_hoodie',collection:'CRESCI Core',rarity:'epic',pricePr:28,description:'Czerwona bluza wkładana przez głowę.'},
  {key:'inferno_flame_tee',name:'T-shirt Inferno Flame',slot:'top',spriteName:'inferno_flame_tee',collection:'CRESCI Core',rarity:'legendary',pricePr:55,description:'Legendarny T-shirt z motywem płomieni.'},
  {key:'gray_training_shorts',name:'Szare szorty treningowe',slot:'bottom',spriteName:'gray_training_shorts',collection:'CRESCI Core',rarity:'common',pricePr:6,description:'Klasyczne szare szorty treningowe.'},
  {key:'red_training_shorts',name:'Czerwone szorty treningowe',slot:'bottom',spriteName:'red_training_shorts',collection:'CRESCI Core',rarity:'rare',pricePr:12,description:'Czerwone szorty z charakterem CRESCI.'},
  {key:'white_sprint_sneakers',name:'Białe sneakersy Sprint',slot:'shoes',spriteName:'white_sprint_sneakers',collection:'CRESCI Core',rarity:'rare',pricePr:12,description:'Lekkie białe sneakersy treningowe.'},
  {key:'red_power_sneakers',name:'Czerwone sneakersy Power',slot:'shoes',spriteName:'red_power_sneakers',collection:'CRESCI Core',rarity:'rare',pricePr:15,description:'Czerwone sneakersy Power.'},
  {key:'compact_dumbbells',name:'Kompaktowe hantle',slot:'accessories',spriteName:'compact_dumbbells',collection:'CRESCI Core',rarity:'legendary',pricePr:60,description:'Legendarny zestaw kompaktowych hantli.'},
  {key:'utility_backpack',name:'Plecak Utility',slot:'back',spriteName:'utility_backpack',collection:'CRESCI Core',rarity:'epic',pricePr:35,description:'Plecak renderowany za postacią.'}
];

function loadCatalogItems(){
  try{
    const catalogPath=process.env.CRESCI_CONTENT_PACK
      ?join(process.env.CRESCI_CONTENT_PACK,'shop','catalog.json')
      :new URL('../public/assets/avatars/v4-production/shop/catalog.json',import.meta.url);
    const catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
    return Array.isArray(catalog.items)?catalog.items:[];
  }catch(error){
    console.error('Nie udało się wczytać katalogu CRESCI:',error.message);
    return null;
  }
}

function catalogAssetName(variant){
  const assetPath=variant?.assets?.runtime?.png||variant?.assets?.master?.png||variant?.assets?.compact?.png||'';
  return String(assetPath).split('/').pop().replace(/\.png$/i,'');
}

function loadManagedItems(catalogItems){
  try{
    const logicalItems=new Map();
    for(const variant of catalogItems){
      if(variant.managedBy!=='cresci-manager'||!variant.contentId||!ITEM_SLOTS.includes(variant.slot))continue;
      const existing=logicalItems.get(variant.contentId);
      if(existing&&existing.spriteName!==variant.assetKey)throw new Error(`Niespójny assetKey dla ${variant.contentId}`);
      logicalItems.set(variant.contentId,{
        key:String(variant.contentId),
        name:String(variant.displayName||variant.contentId),
        slot:variant.slot,
        spriteName:String(variant.assetKey||variant.contentId),
        collection:String(variant.collection||'CRESCI Manager'),
        rarity:String(variant.rarity||'common'),
        pricePr:Math.max(0,Number(variant.price)||0),
        description:'Przedmiot dodany przez CRESCI Manager.'
      });
    }
    return [...logicalItems.values()];
  }catch(error){
    console.error('Nie udało się wczytać itemów CRESCI Manager:',error.message);
    return [];
  }
}

const builtinKeys=new Set(BUILTIN_GAME_ITEMS.map(item=>item.key));
// Starter/legacy layers are part of the avatar base contract rather than the
// editable shop catalog. Only these known catalog-backed built-ins disappear
// when their catalog entry is removed in CRESCI Manager.
const CATALOG_MANAGED_BUILTIN_ASSETS=new Set([
  'black_elite_joggers','black_performance_tank','black_shadow_hightops','black_utility_belt','camo_cargo_pants',
  'charcoal_zip_hoodie','compact_dumbbells','ember_elite_accessories','ember_elite_bottom','ember_elite_headwear',
  'ember_elite_shoes','ember_elite_top','gold_power_chain','gray_training_shorts','inferno_flame_tee',
  'neon_night_accessories','neon_night_bottom','neon_night_headwear','neon_night_shoes','neon_night_top',
  'orange_pullover_hoodie','orange_training_tee','orange_utility_boots','red_knit_beanie','red_power_sneakers',
  'red_pullover_hoodie','red_training_shorts','royal_crest_accessories','royal_crest_bottom','royal_crest_headwear',
  'royal_crest_shoes','royal_crest_top','utility_backpack','white_classic_cap','white_sprint_sneakers'
]);
export function gameItems(){
  const catalogItems=loadCatalogItems();
  if(catalogItems===null)return [...BUILTIN_GAME_ITEMS];
  const catalogByAsset=new Map();
  for(const variant of catalogItems){
    const assetName=catalogAssetName(variant);
    if(assetName&&!catalogByAsset.has(assetName))catalogByAsset.set(assetName,variant);
  }
  const activeBuiltins=BUILTIN_GAME_ITEMS.flatMap(item=>{
    if(!item.spriteName||!CATALOG_MANAGED_BUILTIN_ASSETS.has(item.spriteName))return [item];
    const catalogItem=catalogByAsset.get(item.spriteName);
    if(!catalogItem)return [];
    const catalogPrice=Number(catalogItem.price);
    return [{
      ...item,
      name:String(catalogItem.displayName||item.name),
      collection:String(catalogItem.collection||item.collection||'CRESCI Core'),
      rarity:String(catalogItem.rarity||item.rarity),
      pricePr:Number.isFinite(catalogPrice)?Math.max(0,catalogPrice):item.pricePr
    }];
  });
  const managedItems=loadManagedItems(catalogItems).filter(item=>!builtinKeys.has(item.key));
  return [...activeBuiltins,...managedItems];
}

// Kept as a startup snapshot for backwards compatibility and static contract
// tests. Runtime requests use gameItems(), so Manager changes are visible
// immediately without restarting CRESCI.
export const GAME_ITEMS=Object.freeze(gameItems());

export function gameItem(key){return gameItems().find(item=>item.key===String(key))||null;}

export function avatarFieldForSlot(slot){return{back:'back_style',top:'top_style',bottom:'bottom_style',shoes:'shoes_style',headwear:'headwear',accessories:'accessory'}[slot]||slot;}

export function avatarItems(avatar){
  return ITEM_SLOTS.map(slot=>({slot,key:avatar?.[avatarFieldForSlot(slot)]})).filter(item=>item.key&&item.key!=='none'&&gameItem(item.key));
}
