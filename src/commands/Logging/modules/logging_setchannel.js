import { PermissionsBitField, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { logEvent } from '../../../utils/moderation.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Permission Denied', 'You need **Administrator** permissions to change log channels.')],
            });
        }

        if (!client.db) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Database Error', 'Database not initialized.')],
            });
        }

        const guildId = interaction.guildId;
        const currentConfig = await getGuildConfig(client, guildId);

        const type = interaction.options.getString('type');
const logChannel = interaction.options.getChannel('channel');
const disableLogging = interaction.options.getBoolean('disable');

try {
    currentConfig.logging ??= {
        enabled: false,
        channelId: null,
        channels: {},
        enabledEvents: {},
    };
    currentConfig.logging.channels ??= {};

    if (disableLogging) {
        currentConfig.logging.channels[type] = null;

        const stillHasAnyChannel = Object.values(currentConfig.logging.channels).some(Boolean);
        currentConfig.logging.enabled = stillHasAnyChannel;
        currentConfig.enableLogging = stillHasAnyChannel;

        await setGuildConfig(client, guildId, currentConfig);

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed('Logging Updated 🚫', `Disabled **${type}** logging.`)],
        });
    }

    if (logChannel) {
        const perms = logChannel.permissionsFor(interaction.guild.members.me);
        if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Bot Permission Error', `I need **Send Messages** and **Embed Links** permissions in ${logChannel}.`)],
            });
        }

        currentConfig.logging.channels[type] = logChannel.id;

        if (type === 'common' && !currentConfig.logging.channelId) {
            currentConfig.logging.channelId = logChannel.id;
            currentConfig.logChannelId = logChannel.id;
        }

        currentConfig.logging.enabled = true;
        currentConfig.enableLogging = true;

        await setGuildConfig(client, guildId, currentConfig);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed('Log Channel Set 📝', `**${type}** logs will be sent to ${logChannel}.`)],
        });

        return;
    }

    return InteractionHelper.safeEditReply(interaction, {
        embeds: [errorEmbed('No Option Provided', 'Provide either `channel` or `disable: true`.')],
    });
} catch (error) {
    logger.error('logging setchannel error:', error);
    await InteractionHelper.safeEditReply(interaction, {
        embeds: [errorEmbed('Configuration Error', 'Could not save the configuration.')],
    });
}
                return;
            }

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('No Option Provided', 'Provide one of: `channel` or `disable: True`.\n\n> Ticket transcript and logs channels are managed via `/ticket setup` or `/ticket dashboard`.')],
            });
        } catch (error) {
            logger.error('logging setchannel error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Configuration Error', 'Could not save the configuration.')],
            });
        }
    },
};
