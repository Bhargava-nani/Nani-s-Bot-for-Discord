import { Events } from 'discord.js';
import { removeInvite } from '../utils/inviteTracker.js';

export default {
  name: Events.InviteDelete,
  once: false,

  async execute(invite) {
    try {
      removeInvite(invite.guildId, invite.code);
    } catch {
      // ignore
    }
  },
};
