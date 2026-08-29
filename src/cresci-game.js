import { GAME_ITEMS, avatarFieldForSlot } from './game-items.js';

export const CHECK_IN_XP = 25;

const outfitOptions={back_style:['none'],top_style:['none'],bottom_style:['none'],shoes_style:['none'],headwear:['none'],accessory:['none']};
for(const item of GAME_ITEMS){const field=avatarFieldForSlot(item.slot);if(!outfitOptions[field].includes(item.key))outfitOptions[field].push(item.key);}

export const AVATAR_OPTIONS = Object.freeze({
  gender: ['female', 'male'],
  skin_tone: ['porcelain', 'fair', 'tan', 'olive', 'brown', 'deep', 'light', 'warm'],
  eye_color: ['brown', 'blue', 'green', 'gray'],
  hairstyle: ['short_textured', 'spiky', 'side_swept', 'buzz_cut', 'undercut', 'ponytail', 'bob', 'long', 'high_bun', 'side_braid', 'short', 'fade', 'bun'],
  hair_color: ['black', 'dark_brown', 'chestnut', 'blonde', 'red', 'silver', 'brown'],
  back_style: Object.freeze(outfitOptions.back_style),
  top_style: Object.freeze(outfitOptions.top_style),
  bottom_style: Object.freeze(outfitOptions.bottom_style),
  shoes_style: Object.freeze(outfitOptions.shoes_style),
  headwear: Object.freeze(outfitOptions.headwear),
  accessory: Object.freeze(outfitOptions.accessory)
});

export const AVATAR_DEFAULTS = Object.freeze({
  gender: 'female', skin_tone: 'fair', eye_color: 'brown', hairstyle: 'ponytail', hair_color: 'dark_brown', back_style: 'none',
  top_style: 'cresci_tank', bottom_style: 'training_shorts', shoes_style: 'trainers', headwear: 'none', accessory: 'none'
});

export function validateAvatar(input = {}) {
  const avatar = {};
  for (const [field, allowed] of Object.entries(AVATAR_OPTIONS)) {
    const value = String(input[field] || AVATAR_DEFAULTS[field] || '');
    if (!allowed.includes(value)) throw new Error('Uzupełnij wszystkie opcje avatara.');
    avatar[field] = value;
  }
  return avatar;
}

export function levelFromXp(value) {
  const totalXp = Math.max(0, Math.floor(Number(value) || 0));
  let level = 1;
  let levelStartXp = 0;
  let requiredXp = 100;
  while (totalXp >= levelStartXp + requiredXp) {
    levelStartXp += requiredXp;
    level += 1;
    requiredXp = 100 + (level - 1) * 25;
  }
  const currentXp = totalXp - levelStartXp;
  return {
    level,
    total_xp: totalXp,
    current_xp: currentXp,
    required_xp: requiredXp,
    progress_percent: Math.round(currentXp / requiredXp * 100)
  };
}
