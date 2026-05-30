import {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/guildConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('🏆 Manage achievement announcements')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setchannel')
        .setDescription('📣 Set the achievement announcement channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Achievement announcement channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setmembersrole')
        .setDescription('👥 Set the MEMBERS ping role')
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Role that should be pinged on achievement announcements')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('📊 Show achievement announcement settings'),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();
    const config = await getGuildConfig(client, guildId);

    config.achievements ??= {
      announcementChannelId: null,
      membersRoleId: null,
    };

    if (subcommand === 'setchannel') {
      const channel = interaction.options.getChannel('channel');

      if (!channel?.isTextBased?.()) {
        return interaction.reply({
          content: '❌ Please choose a text channel.',
          ephemeral: true,
        });
      }

      config.achievements.announcementChannelId = channel.id;
      await setGuildConfig(client, guildId, config);

      return interaction.reply({
        content: `📣 Achievement announcement channel set to ${channel}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'setmembersrole') {
      const role = interaction.options.getRole('role');

      config.achievements.membersRoleId = role.id;
      await setGuildConfig(client, guildId, config);

      return interaction.reply({
        content: `👥 MEMBERS ping role set to ${role}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'status') {
      const channelId = config.achievements?.announcementChannelId;
      const membersRoleId = config.achievements?.membersRoleId;

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏆 Achievement Settings')
        .addFields(
          { name: '📣 Announcement Channel', value: channelId ? `<#${channelId}>` : 'Not set', inline: true },
          { name: '👥 MEMBERS Role', value: membersRoleId ? `<@&${membersRoleId}>` : 'Not set', inline: true },
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
