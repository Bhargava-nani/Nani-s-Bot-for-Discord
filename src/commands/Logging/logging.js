import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import setchannel from './modules/logging_setchannel.js';
import filter from './modules/logging_filter.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Manage audit logging for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)

        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the interactive logging dashboard — view status and toggle event categories.')
        )

        .addSubcommand((subcommand) =>
            subcommand
                .setName('setchannel')
                .setDescription('📌 Set a specific log channel for one log type.')
                .addStringOption((option) =>
                    option
                        .setName('type')
                        .setDescription('🧭 Which log type to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: '🛡️ Security', value: 'security' },
                            { name: '⚔️ Moderation', value: 'moderation' },
                            { name: '🎫 Ticket', value: 'ticket' },
                            { name: '👥 Member', value: 'member' },
                            { name: '💬 Message', value: 'message' },
                            { name: '🎭 Role', value: 'role' },
                            { name: '🎉 Giveaway', value: 'giveaway' },
                            { name: '📈 Leveling', value: 'leveling' },
                            { name: '🔁 Reaction Role', value: 'reactionrole' },
                            { name: '🔢 Counter', value: 'counter' },
                            { name: '✨ Common', value: 'common' }
                        )
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('📣 The text channel for that log type.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('🚫 Disable that log type.')
                        .setRequired(false)
                )
        )

        .addSubcommandGroup((group) =>
            group
                .setName('filter')
                .setDescription('Manage the log ignore list (users and channels to skip).')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a user or channel to the log ignore list.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Whether to ignore a user or channel.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('The ID of the user or channel to ignore.')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a user or channel from the log ignore list.')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Whether this is a user or channel.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'User', value: 'user' },
                                    { name: 'Channel', value: 'channel' }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('The ID of the user or channel to remove from the ignore list.')
                                .setRequired(true)
                        )
                )
        ),

    async execute(interaction, config, client) {
        try {
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            await InteractionHelper.safeDefer(interaction);

            if (subcommand === 'setchannel') {
                return await setchannel.execute(interaction, config, client);
            }

            if (subcommandGroup === 'filter') {
                return await filter.execute(interaction, config, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not recognised.')],
            });
        } catch (error) {
            logger.error('logging command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Error', 'An unexpected error occurred.')],
                ephemeral: true,
            }).catch(() => {});
        }
    },
};
