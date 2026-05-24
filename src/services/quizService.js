import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import {
  getCategories,
  getCategoryRemainingCount,
  getLowStockCategories,
  pickQuestionFromCategory,
} from '../data/quizQuestions.js';
import { getGuildConfig, setGuildConfig } from './guildConfig.js';
import { logger } from '../utils/logger.js';

const LOW_STOCK_THRESHOLD = 10;
const activeQuizSessions = new Map();
const runtimeQuizState = new Map();
const lastQuizRunByGuild = new Map();
function getNextSunday6PM() {
  const now = new Date();
  const next = new Date(now);

  const daysUntilSunday = (7 - now.getDay()) % 7;
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(18, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}
function getLocalDayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function shouldRunSundayQuiz(date = new Date()) {
  return date.getDay() === 0 && date.getHours() === 18 && date.getMinutes() < 5;
}

function getRuntimeState(guildId) {
  if (!runtimeQuizState.has(guildId)) {
    runtimeQuizState.set(guildId, {
      usedQuestionIdsByCategory: {},
      lastLowStockReminderAt: 0,
    });
  }
  return runtimeQuizState.get(guildId);
}

function ensureQuizConfig(config) {
  config.quiz ??= {
    enabled: false,
    channelId: null,
    leaderboardChannelId: null,
    questionCount: 10,
    answerWindowMs: 60000,
  };

  config.quiz.usedQuestionIdsByCategory ??= {};
  return config;
}

function getUsedIdsForCategory(config, state, category) {
  const persisted = config.quiz?.usedQuestionIdsByCategory?.[category];
  if (Array.isArray(persisted)) return persisted;

  const runtime = state.usedQuestionIdsByCategory?.[category];
  if (Array.isArray(runtime)) return runtime;

  return [];
}

function setUsedIdsForCategory(config, state, category, ids) {
  config.quiz.usedQuestionIdsByCategory ??= {};
  config.quiz.usedQuestionIdsByCategory[category] = ids;

  state.usedQuestionIdsByCategory ??= {};
  state.usedQuestionIdsByCategory[category] = ids;
}

function markQuestionUsed(config, state, category, questionId) {
  const current = getUsedIdsForCategory(config, state, category);
  if (current.includes(questionId)) return;

  const next = [...current, questionId];
  setUsedIdsForCategory(config, state, category, next);
}

function pickWeeklyQuestionSet(config, state) {
  const categories = getCategories();
  const picked = [];

  for (const category of categories) {
    const usedIds = getUsedIdsForCategory(config, state, category);
    const question = pickQuestionFromCategory(category, usedIds);

    if (!question) continue;

    picked.push({
      ...question,
      category,
    });

    markQuestionUsed(config, state, category, question.id);
  }

  return picked;
}

async function persistQuizState(client, guildId, config) {
  try {
    await setGuildConfig(client, guildId, config);
  } catch (error) {
    logger.error(`❌ Failed to persist quiz state for guild ${guildId}:`, error);
  }
}

function buildAnswerRow(guildId, sessionId, questionIndex, question) {
  const letters = ['A', 'B', 'C', 'D'];

  const buttons = question.options.slice(0, 4).map((option, index) =>
    new ButtonBuilder()
      .setCustomId(`quiz:${guildId}:${sessionId}:${questionIndex}:${index}`)
      .setLabel(`${letters[index]} ${option}`.slice(0, 80))
      .setStyle(ButtonStyle.Primary),
  );

  return new ActionRowBuilder().addComponents(buttons);
}

async function sendLowStockReminder(guild, config, state) {
  const lowStock = getLowStockCategories(
    config.quiz?.usedQuestionIdsByCategory ?? state.usedQuestionIdsByCategory ?? {},
    LOW_STOCK_THRESHOLD,
  );

  if (lowStock.length === 0) return;

  const now = Date.now();
  if (now - state.lastLowStockReminderAt < 24 * 60 * 60 * 1000) {
    return;
  }

  state.lastLowStockReminderAt = now;

  const channelId =
    config.logging?.channels?.security ||
    config.logging?.channels?.common ||
    config.logging?.channelId ||
    config.quiz?.channelId;

  if (!channelId) return;

  const channel =
    guild.channels.cache.get(channelId) ||
    (await guild.channels.fetch(channelId).catch(() => null));

  if (!channel?.isTextBased?.()) return;

  const embed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('⚠️ Quiz Question Bank Low')
    .setDescription(
      lowStock
        .map((item) => `• **${item.category}** — **${item.remaining}** questions left`)
        .join('\n'),
    )
    .addFields({
      name: '🧩 Reminder',
      value: 'Please reload the category banks when they reach low stock.',
    })
    .setTimestamp()
    .setFooter({ text: `${guild.name} • Quiz Stock` });

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function runQuestion(channel, session, questionIndex) {
  const question = session.questions[questionIndex];
  if (!question) return;

  const row = buildAnswerRow(session.guildId, session.id, questionIndex, question);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🧠 Weekly Quiz • Question ${questionIndex + 1}/${session.questions.length}`)
    .setDescription(question.question)
    .addFields(
      {
        name: '📚 Category',
        value: question.category,
        inline: true,
      },
      {
        name: '🏆 Points',
        value: String(question.points ?? 1),
        inline: true,
      },
      {
        name: '⏱️ Time',
        value: `${Math.round(session.answerWindowMs / 1000)} seconds`,
        inline: true,
      },
      ...question.options.slice(0, 4).map((option, index) => ({
        name: `${String.fromCharCode(65 + index)}`,
        value: option,
        inline: false,
      })),
    )
    .setTimestamp()
    .setFooter({ text: 'Answer using the buttons below' });

  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  const answeredUsers = new Set();

  const collector = message.createMessageComponentCollector({
    time: session.answerWindowMs,
    filter: (interaction) =>
      interaction.customId.startsWith(`quiz:${session.guildId}:${session.id}:${questionIndex}:`),
  });

  collector.on('collect', async (interaction) => {
    try {
      const parts = interaction.customId.split(':');
      const selectedIndex = Number(parts[4]);

      if (answeredUsers.has(interaction.user.id)) {
        return interaction.reply({
          content: '⏳ You already answered this question.',
          ephemeral: true,
        }).catch(() => {});
      }

      answeredUsers.add(interaction.user.id);

      const correct = selectedIndex === question.answerIndex;
      const currentScore = session.scores.get(interaction.user.id) ?? 0;
      const points = question.points ?? 1;

      if (correct) {
        session.scores.set(interaction.user.id, currentScore + points);
      }

      await interaction.reply({
        content: correct
          ? `✅ Correct! You earned **${points}** point.`
          : `❌ Wrong! Correct answer: **${String.fromCharCode(65 + question.answerIndex)}**`,
        ephemeral: true,
      }).catch(() => {});
    } catch (error) {
      logger.error('❌ Quiz answer handling error:', error);
    }
  });

  await new Promise((resolve) => collector.on('end', resolve));
  await message.edit({ components: [] }).catch(() => {});

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⏱️ Question Ended')
        .setDescription(`Correct answer: **${String.fromCharCode(65 + question.answerIndex)}**`)
        .setTimestamp(),
    ],
  }).catch(() => {});
}

function buildLeaderboard(session) {
  return [...session.scores.entries()]
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score);
}

export async function startWeeklyQuiz(guild, channel) {
  if (!guild || !channel?.isTextBased?.()) return false;
  if (activeQuizSessions.has(guild.id)) return false;

  const config = ensureQuizConfig(await getGuildConfig(guild.client, guild.id));
  const state = getRuntimeState(guild.id);

  const questions = pickWeeklyQuestionSet(config, state);

  if (questions.length === 0) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('❌ Quiz Bank Empty')
          .setDescription('No available questions left right now. Please reload your question bank.')
          .setTimestamp(),
      ],
    }).catch(() => {});

    await sendLowStockReminder(guild, config, state);
    return false;
  }

  await persistQuizState(guild.client, guild.id, config);

  activeQuizSessions.set(guild.id, {
    id: `${guild.id}:${Date.now()}`,
    guildId: guild.id,
    channelId: channel.id,
    questions,
    scores: new Map(),
    answerWindowMs: config.quiz.answerWindowMs || 60000,
  });

  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('📣 Weekly Mixed Quiz Started')
          .setDescription(
            'This round uses mixed questions from all categories. Answer with the buttons under each question.',
          )
          .addFields({
            name: '📚 Categories',
            value: 'Dating, Anime, Gaming, Fashion, Tech, AI, Hacking, Law, GK, Sports/Geography',
          })
          .setTimestamp(),
      ],
    });

    const session = activeQuizSessions.get(guild.id);

    for (let i = 0; i < session.questions.length; i += 1) {
      await runQuestion(channel, session, i);
    }

    const rows = buildLeaderboard(session);
    const winner = rows[0];
    const leaderboardText =
      rows.length > 0
        ? rows
            .slice(0, 10)
            .map((row, index) => `**${index + 1}.** <@${row.userId}> — **${row.score}** pts`)
            .join('\n')
        : 'No one scored this week.';

    const winnerText = winner
      ? `🥇 Winner: <@${winner.userId}> with **${winner.score}** points!`
      : 'No winner this week.';

    const leaderboardChannelId =
      config.quiz.leaderboardChannelId ||
      config.quiz.channelId ||
      channel.id;

    const leaderboardChannel =
      guild.channels.cache.get(leaderboardChannelId) ||
      (await guild.channels.fetch(leaderboardChannelId).catch(() => null));

    if (leaderboardChannel?.isTextBased?.()) {
      await leaderboardChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🏆 Weekly Quiz Results')
            .setDescription(`${winnerText}\n\n${leaderboardText}`)
            .setTimestamp(),
        ],
      }).catch(() => {});
    }

    await sendLowStockReminder(guild, config, state);

    return true;
  } catch (error) {
    logger.error('❌ Weekly quiz failed:', error);
    return false;
  } finally {
    activeQuizSessions.delete(guild.id);
  }
}

export async function runQuizScheduler(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const config = ensureQuizConfig(await getGuildConfig(client, guild.id));
      const state = getRuntimeState(guild.id);

      if (!config.quiz.enabled || !config.quiz.channelId) continue;
      if (activeQuizSessions.has(guild.id)) continue;
      if (!shouldRunSundayQuiz()) continue;

      const runKey = getLocalDayKey();
      if (lastQuizRunByGuild.get(guild.id) === runKey) continue;

      const channel =
        guild.channels.cache.get(config.quiz.channelId) ||
        (await guild.channels.fetch(config.quiz.channelId).catch(() => null));

      if (!channel?.isTextBased?.()) continue;

      const started = await startWeeklyQuiz(guild, channel);
      if (started) {
        lastQuizRunByGuild.set(guild.id, runKey);
      }

      await sendLowStockReminder(guild, config, state);
    } catch (error) {
      logger.error(`❌ Quiz scheduler error for guild ${guild.id}:`, error);
    }
  }
}

export async function getQuizStatus(client, guildId) {
  const config = ensureQuizConfig(await getGuildConfig(client, guildId));
  const state = getRuntimeState(guildId);
  const bank = config.quiz.usedQuestionIdsByCategory ?? state.usedQuestionIdsByCategory ?? {};

  return {
    enabled: !!config.quiz.enabled,
    channelId: config.quiz.channelId,
    leaderboardChannelId: config.quiz.leaderboardChannelId,
    questionCount: config.quiz.questionCount,
    nextRunAt: getNextSunday6PM().getTime(),
    answerWindowMs: config.quiz.answerWindowMs,
    categories: getCategories().map((category) => ({
      category,
      remaining: getCategoryRemainingCount(category, bank[category] ?? []),
    })),
  };
}
