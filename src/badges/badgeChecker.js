import { BADGES } from './badgeDefinitions.js';
import { awardBadgeWithAnnouncement } from './badgeAwarder.js';

export async function checkBadges({
  message,
  stats = {},
  client,
}) {
  if (!message?.guild || message.author?.bot) return;

  // FIRST MESSAGE
  if (stats.messageCount === 1) {
    await giveBadge(message, BADGES.FIRST_MESSAGE);
  }

  // THOUGHT STREAK
  if (stats.thoughtStreak >= 7) {
    await giveBadge(message, BADGES.THOUGHT_MASTER);
  }

  // QOTD STREAK
  if (stats.qotdStreak >= 30) {
    await giveBadge(message, BADGES.QOTD_WARRIOR);
  }

  // VOICE
  if (stats.voiceHours >= 50) {
    await giveBadge(message, BADGES.VOICE_LEGEND);
  }
}

async function giveBadge(message, badge) {
  await awardBadgeWithAnnouncement(message, badge);
}
