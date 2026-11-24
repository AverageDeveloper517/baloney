// The whole permission ask, in one place. Keeping this tiny is the point: a
// server owner can read the invite and see that nothing dangerous is requested.

export const SCOPES = ['bot', 'applications.commands'];

// Discord permission bits. The bot sends one public message per game, edits it,
// and reads nothing. Threads are supported because parties happen in threads.
export const BOT_PERMISSIONS = {
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  EmbedLinks: 1n << 14n,
  SendMessagesInThreads: 1n << 38n
};

export const PERMISSION_NAMES = {
  'View Channels': BOT_PERMISSIONS.ViewChannel,
  'Send Messages': BOT_PERMISSIONS.SendMessages,
  'Embed Links': BOT_PERMISSIONS.EmbedLinks,
  'Send Messages in Threads': BOT_PERMISSIONS.SendMessagesInThreads
};

export const PERMISSION_TOTAL = Object.values(BOT_PERMISSIONS).reduce((sum, bit) => sum + bit, 0n);

export function inviteUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES.join(' '),
    permissions: PERMISSION_TOTAL.toString()
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// Permissions deliberately not requested, listed for the README and the doctor.
export const NOT_REQUESTED = [
  'Administrator',
  'Manage Server',
  'Manage Messages',
  'Manage Channels',
  'Kick or Ban Members',
  'Read Message History',
  'Message Content intent',
  'Server Members intent'
];
