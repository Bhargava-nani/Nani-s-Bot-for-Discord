import { BADGES } from './badgeDefinitions.js';
import { awardBadge } from './badgeAwarder.js';
import { EmbedBuilder } from 'discord.js';

export async function checkBadges({
  message,
  stats,
  client,
}) {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // FIRST MESSAGE
  if (stats.messageCount === 1) {
    await giveBadge(message, guildId, userId, BADGES.FIRST_MESSAGE);
  }

  // THOUGHT STREAK
  if (stats.thoughtStreak >= 7) {
    await giveBadge(message, guildId, userId, BADGES.THOUGHT_MASTER);
  }

  // QOTD STREAK
  if (stats.qotdStreak >= 30) {
    await giveBadge(message, guildId, userId, BADGES.QOTD_WARRIOR);
  }

  // VOICE
  if (stats.voiceHours >= 50) {
    await giveBadge(message, guildId, userId, BADGES.VOICE_LEGEND);
  }
}

async function giveBadge(message, guildId, userId, badge) {
  const added = await awardBadge(guildId, userId, badge.id);

  if (!added) return;

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏅 New Badge Earned!')
    .setDescription(
      `${message.author} earned ${badge.emoji} **${badge.name}**\n${badge.description}`,
    );

  await message.channel.send({
    embeds: [embed],
  }).catch(() => {});
}
