import { getFromDb, setInDb } from '../utils/database.js';

function getBadgeKey(guildId, userId) {
  return `badges:${guildId}:${userId}`;
}

export async function getUserBadges(guildId, userId) {
  return (await getFromDb(getBadgeKey(guildId, userId), [])) || [];
}

export async function awardBadge(guildId, userId, badgeId) {
  const badges = await getUserBadges(guildId, userId);

  if (badges.includes(badgeId)) {
    return false;
  }

  badges.push(badgeId);

  await setInDb(getBadgeKey(guildId, userId), badges);

  return true;
}
