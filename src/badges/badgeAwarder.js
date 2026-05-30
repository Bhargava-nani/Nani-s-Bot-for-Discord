import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { getFromDb, setInDb } from '../utils/database.js';

function getBadgeKey(guildId, userId) {
  return `badges:${guildId}:${userId}`;
}

function getRarityColor(rarity) {
  switch (rarity) {
    case 'LEGENDARY':
      return '#F1C40F';
    case 'EPIC':
      return '#9B59B6';
    case 'RARE':
      return '#3498DB';
    default:
      return '#57F287';
  }
}

async function announceBadge(message, badge) {
  const config = await getGuildConfig(message.client, message.guild.id);
  const channelId =
    config.achievements?.announcementChannelId ||
    config.events?.announcementChannelId ||
    config.announcementChannelId ||
    config.logging?.channels?.common ||
    config.logging?.channelId;

  if (!channelId) return;

  const channel =
    message.guild.channels.cache.get(channelId) ||
    (await message.guild.channels.fetch(channelId).catch(() => null));

  if (!channel?.isTextBased?.()) return;

  const embed = new EmbedBuilder()
    .setColor(getRarityColor(badge.rarity))
    .setTitle(`${badge.emoji} New Badge Earned`)
    .setDescription(
      `${message.author} unlocked **${badge.name}**\n${badge.description}`,
    )
    .addFields(
      { name: 'Rarity', value: badge.rarity, inline: true },
      { name: 'Badge ID', value: badge.id, inline: true },
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
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

export async function awardBadgeWithAnnouncement(message, badge) {
  const added = await awardBadge(message.guild.id, message.author.id, badge.id);
  if (!added) return false;

  const member = await message.guild.members
    .fetch(message.author.id)
    .catch(() => null);

  if (member && badge.roleId) {
    await member.roles.add(String(badge.roleId)).catch(() => {});
  }

  await announceBadge(message, badge);
  return true;
}
