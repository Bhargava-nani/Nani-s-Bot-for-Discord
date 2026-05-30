import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from './guildConfig.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { BADGES } from '../badges/badgeDefinitions.js';
import { awardBadgeWithAnnouncement } from '../badges/badgeAwarder.js';

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getStreakDataKey(guildId) {
  return `guild:${guildId}:communityStreaks`;
}

async function getStreakData(client, guildId) {
  return (await getFromDb(getStreakDataKey(guildId), {})) || {};
}

async function saveStreakData(guildId, data) {
  await setInDb(getStreakDataKey(guildId), data);
}
if (message.channel.id === streakConfig.qotdChannelId) {
  await awardBadgeWithAnnouncement(message, BADGES.QOTD_PARTICIPANT);
}

if (nextStreak === 3) {
  await awardBadgeWithAnnouncement(message, BADGES.FIRST_STREAK);
}

if (nextStreak === 7) {
  await awardBadgeWithAnnouncement(message, BADGES.THOUGHT_MASTER);
}

if (nextStreak === 30) {
  await awardBadgeWithAnnouncement(message, BADGES.QOTD_WARRIOR);
}

if (nextStreak === 100) {
  await awardBadgeWithAnnouncement(message, BADGES.STREAK_GOD);
}

function isRelevantChannel(config, channelId) {
  return (
    channelId === config?.communityStreaks?.qotdChannelId ||
    channelId === config?.communityStreaks?.thoughtsChannelId
  );
}

export async function handleCommunityStreak(message, client) {
  try {
    if (!message.guild || message.author.bot) return;

    const config = await getGuildConfig(client, message.guild.id);
    const streakConfig = config.communityStreaks;

    if (!streakConfig?.enabled) return;
    if (!isRelevantChannel(streakConfig, message.channel.id)) return;
    if (!message.content || !message.content.trim()) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const today = getDayKey();

    const streakData = await getStreakData(client, guildId);
    const userData = streakData[userId] || {
      streak: 0,
      lastActiveDay: null,
    };

    if (userData.lastActiveDay === today) {
      return;
    }

    const lastDay = userData.lastActiveDay;
    let nextStreak = 1;

    if (lastDay) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = getDayKey(yesterday);

      nextStreak = lastDay === yesterdayKey ? (userData.streak || 0) + 1 : 1;
    }

    userData.streak = nextStreak;
    userData.lastActiveDay = today;
    streakData[userId] = userData;

    await saveStreakData(guildId, streakData);

    const announceChannelId =
      streakConfig.announcementChannelId ||
      streakConfig.qotdChannelId ||
      streakConfig.thoughtsChannelId;

    if (!announceChannelId) return;

    const channel =
      message.guild.channels.cache.get(announceChannelId) ||
      (await message.guild.channels.fetch(announceChannelId).catch(() => null));

    if (!channel?.isTextBased?.()) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🔥 Streak Updated')
      .setDescription(
        `**${message.author}** streak is now **${nextStreak} day${nextStreak === 1 ? '' : 's'}** in QOTD/Thoughts.`,
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    logger.error('Error in community streak handler:', error);
  }
}
