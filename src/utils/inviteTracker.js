const inviteCache = new Map();

function snapshotInvite(invite) {
  return {
    code: invite.code,
    uses: invite.uses ?? 0,
    inviterId: invite.inviterId ?? invite.inviter?.id ?? null,
    inviterTag: invite.inviter?.tag ?? null,
    channelId: invite.channelId ?? null,
    temporary: invite.temporary ?? false,
    maxUses: invite.maxUses ?? null,
  };
}

export function getGuildInviteSnapshot(guildId) {
  return new Map(inviteCache.get(guildId) ?? []);
}

export async function primeGuildInvites(guild) {
  if (!guild?.invites?.fetch) {
    return getGuildInviteSnapshot(guild?.id);
  }

  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) {
    return getGuildInviteSnapshot(guild.id);
  }

  const snapshot = new Map();
  for (const invite of invites.values()) {
    snapshot.set(invite.code, snapshotInvite(invite));
  }

  inviteCache.set(guild.id, snapshot);
  return snapshot;
}

export function upsertInvite(invite) {
  if (!invite?.guild?.id || !invite?.code) return;

  const snapshot = inviteCache.get(invite.guild.id) ?? new Map();
  snapshot.set(invite.code, snapshotInvite(invite));
  inviteCache.set(invite.guild.id, snapshot);
}

export function removeInvite(guildId, code) {
  const snapshot = inviteCache.get(guildId);
  if (!snapshot) return;

  snapshot.delete(code);
}

export function detectUsedInvite(beforeSnapshot, afterInvites) {
  if (!afterInvites) return null;

  let bestMatch = null;

  for (const invite of afterInvites.values()) {
    const previousUses = beforeSnapshot.get(invite.code)?.uses ?? 0;
    const currentUses = invite.uses ?? 0;
    const delta = currentUses - previousUses;

    if (delta > 0 && (!bestMatch || delta > bestMatch.delta)) {
      bestMatch = { invite, delta };
    }
  }

  return bestMatch?.invite ?? null;
}
