import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';
import { getQuizStatus, startWeeklyQuiz } from '../../services/quizService.js';

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
export default {
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('🧠 Weekly mixed quiz system')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription('📣 Set the quiz channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Quiz channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setleaderboard')
        .setDescription('🏆 Set the leaderboard channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Leaderboard channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('✅ Enable or disable the weekly quiz')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Turn quiz on or off').setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('🚀 Start a quiz immediately'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('📊 Show quiz status and remaining question stock'),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client;
    const guildId = interaction.guild.id;
    const config = await getGuildConfig(client, guildId);

    config.quiz ??= {
      enabled: false,
      channelId: null,
      leaderboardChannelId: null,
      questionCount: 10,
      answerWindowMs: 60000,
      usedQuestionIdsByCategory: {},
    };

    if (subcommand === 'setchannel') {
      const channel = interaction.options.getChannel('channel');

      if (!channel?.isTextBased?.()) {
        return interaction.reply({
          content: '❌ Please choose a text channel.',
          ephemeral: true,
        });
      }

      config.quiz.channelId = channel.id;
     
      await setGuildConfig(client, guildId, config);

      return interaction.reply({
        content: `📣 Quiz channel set to ${channel}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'setleaderboard') {
      const channel = interaction.options.getChannel('channel');

      if (!channel?.isTextBased?.()) {
        return interaction.reply({
          content: '❌ Please choose a text channel.',
          ephemeral: true,
        });
      }

      config.quiz.leaderboardChannelId = channel.id;
      await setGuildConfig(client, guildId, config);

      return interaction.reply({
        content: `🏆 Leaderboard channel set to ${channel}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      config.quiz.enabled = enabled;

    

      await setGuildConfig(client, guildId, config);

      return interaction.reply({
        content: enabled ? '✅ Weekly quiz enabled' : '🚫 Weekly quiz disabled',
        ephemeral: true,
      });
    }

    if (subcommand === 'start') {
      const channel =
        interaction.guild.channels.cache.get(config.quiz.channelId) ||
        (await interaction.guild.channels.fetch(config.quiz.channelId).catch(() => null));

      if (!channel?.isTextBased?.()) {
        return interaction.reply({
          content: '❌ Quiz channel is not set or is not a text channel.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: '🚀 Starting quiz now...',
        ephemeral: true,
      });

      await startWeeklyQuiz(interaction.guild, channel);
      return;
    }

    if (subcommand === 'status') {
      const status = await getQuizStatus(client, guildId);
      const nextRunText = `<t:${Math.floor(getNextSunday6PM().getTime() / 1000)}:F>`;
      const remainingText = status.categories
        .map((item) => `• **${item.category}** — **${item.remaining}** left`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Quiz Status')
        .addFields(
          { name: '✅ Enabled', value: status.enabled ? 'Yes' : 'No', inline: true },
          { name: '🕒 Next Run', value: nextRunText, inline: true },
          { name: '🎯 Questions per week', value: String(status.questionCount), inline: true },
          { name: '📣 Quiz Channel', value: status.channelId ? `<#${status.channelId}>` : 'Not set', inline: true },
          { name: '🏆 Leaderboard Channel', value: status.leaderboardChannelId ? `<#${status.leaderboardChannelId}>` : 'Not set', inline: true },
          { name: '📚 Remaining Question Stock', value: remainingText || 'No data', inline: false },
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
