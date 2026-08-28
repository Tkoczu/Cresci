const WGER_BASE = 'https://wger.de/api/v2';
const INDEX_TTL = 60 * 60 * 1000;

const categoryMap = {
  Abs: 'Brzuch', Arms: 'Ramiona', Back: 'Plecy', Calves: 'Łydki',
  Cardio: 'Cardio', Chest: 'Klatka piersiowa', Legs: 'Nogi', Shoulders: 'Barki'
};

let translationCache = { expires: 0, items: [] };

function normalized(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'CRESCI/1.0 (self-hosted exercise tracker)' },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Katalog wger odpowiedział kodem ${response.status}.`);
  return response.json();
}

async function getTranslationIndex(fetchImpl) {
  if (translationCache.expires > Date.now() && translationCache.items.length) return translationCache.items;
  const payload = await fetchJson(`${WGER_BASE}/exercise-translation/?limit=5000`, fetchImpl);
  const items = Array.isArray(payload) ? payload : payload.results || [];
  translationCache = { items, expires: Date.now() + INDEX_TTL };
  return items;
}

export function mapWgerExercise(raw, translation) {
  const equipment = (raw.equipment || []).map(item => item.name).filter(Boolean);
  const muscles = [...(raw.muscles || []), ...(raw.muscles_secondary || [])]
    .map(item => item.name_en || item.name).filter(Boolean);
  const equipmentText = equipment.join(' ').toLowerCase();
  const load_mode = /barbell|plate/.test(equipmentText) ? 'plates' : /machine|cable/.test(equipmentText) ? 'steps' : 'direct';
  return {
    source: 'wger', source_id: raw.id,
    name: translation?.name || raw.translations?.find(item => item.language === 2)?.name || raw.translations?.[0]?.name || `Ćwiczenie ${raw.id}`,
    category: categoryMap[raw.category?.name] || raw.category?.name || 'Inne',
    muscles, equipment, load_mode
  };
}

export async function searchWgerExercises(query, { fetchImpl = fetch } = {}) {
  const needle = normalized(query);
  if (needle.length < 2) throw new Error('Wpisz co najmniej 2 znaki.');
  const index = await getTranslationIndex(fetchImpl);
  const matches = index
    .map(item => ({ item, name: normalized(item.name) }))
    .filter(({ name }) => name.includes(needle))
    .sort((a, b) => Number(!a.name.startsWith(needle)) - Number(!b.name.startsWith(needle)) || a.name.localeCompare(b.name))
    .filter(({ item }, position, all) => all.findIndex(candidate => candidate.item.exercise === item.exercise) === position)
    .slice(0, 12);
  return Promise.all(matches.map(async ({ item }) => {
    const raw = await fetchJson(`${WGER_BASE}/exerciseinfo/${item.exercise}/`, fetchImpl);
    return mapWgerExercise(raw, item);
  }));
}

export function clearCatalogCache() { translationCache = { expires: 0, items: [] }; }
