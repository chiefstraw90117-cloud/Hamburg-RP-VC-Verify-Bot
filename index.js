require('dotenv').config();
const express = require('express');
const session = require('express-session');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AuditLogEvent,
} = require('discord.js');

const store = require('./utils/store');
const { refreshToken, addGuildMember } = require('./utils/discordOAuth');
const { verifyRouter } = require('./routes/verify');
const { dashboardRouter } = require('./routes/dashboard');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration],
});

// ---------------------------------------------------------------------------
// Verify-Panel posten
// ---------------------------------------------------------------------------

async function postVerifyPanel(discordClient, channelId) {
  const channel = await discordClient.channels.fetch(channelId);
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setAuthor({ name: discordClient.user.username, iconURL: discordClient.user.displayAvatarURL() })
    .setTitle('✅ Verifizierung')
    .setDescription(
      'Klicke auf den Button unten, um dich mit deinem Discord-Account zu verifizieren und Zugriff auf den Server zu erhalten.\n\n' +
        '⚠️ Solltest du den Server danach freiwillig verlassen, wirst du automatisch wieder hinzugefügt.'
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Verifizieren').setEmoji('✅').setStyle(ButtonStyle.Link).setURL(`${process.env.PUBLIC_URL}/verify`)
  );
  await channel.send({ embeds: [embed], components: [row] });
}

// ---------------------------------------------------------------------------
// Discord-Events
// ---------------------------------------------------------------------------

client.once('clientReady', () => {
  console.log(`Eingeloggt als ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  const config = store.getConfig();
  if (!config.unverifiedRoleId) return;
  try {
    await member.roles.add(config.unverifiedRoleId, 'Automatisch beim Server-Beitritt');
  } catch (err) {
    console.error('Konnte Unverified-Rolle nicht vergeben:', err.message);
  }
});

client.on('guildBanAdd', async (ban) => {
  const verified = store.getVerifiedUser(ban.user.id);
  if (verified) {
    store.saveVerifiedUser(ban.user.id, { banned: true });
  }
});

client.on('guildMemberRemove', async (member) => {
  const verified = store.getVerifiedUser(member.id);
  if (!verified || verified.banned) return; // nie verifiziert oder gebannt -> kein Rejoin

  const guild = member.guild;

  // 1. Direkt prüfen: ist die Person aktuell gebannt?
  try {
    await guild.bans.fetch(member.id);
    store.saveVerifiedUser(member.id, { banned: true });
    store.addLogEntry({ type: 'rejoin-skip', userId: member.id, success: true, error: 'Gebannt' });
    return;
  } catch {
    // kein Ban gefunden -> weiter prüfen
  }

  // 2. Audit-Log prüfen: wurde die Person gerade gekickt?
  try {
    const kickLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
    const kickEntry = kickLogs.entries.find(
      (entry) => entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 10000
    );
    if (kickEntry) {
      store.addLogEntry({ type: 'rejoin-skip', userId: member.id, success: true, error: 'Gekickt' });
      return;
    }
  } catch (err) {
    console.error('Konnte Audit-Log nicht prüfen:', err.message);
  }

  // 3. Freiwilliger Leave -> automatisch wieder hinzufügen
  try {
    let accessToken = verified.accessToken;
    if (Date.now() >= verified.expiresAt - 60000) {
      const refreshed = await refreshToken(verified.refreshToken);
      accessToken = refreshed.access_token;
      store.saveVerifiedUser(member.id, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      });
    }

    const config = store.getConfig();
    const zielRollen = [config.verifiedRoleId, config.memberRoleId].filter(Boolean);
    await addGuildMember(process.env.GUILD_ID, member.id, accessToken, zielRollen);
    store.addLogEntry({ type: 'rejoin', userId: member.id, username: verified.username, success: true });
  } catch (err) {
    console.error('Auto-Rejoin fehlgeschlagen:', err.message);
    store.addLogEntry({ type: 'rejoin', userId: member.id, username: verified.username, success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Webserver
// ---------------------------------------------------------------------------

const app = express();
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'bitte-aendern',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);
app.use(express.static('public'));
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use(verifyRouter(client));
app.use(dashboardRouter(client));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);

module.exports = { postVerifyPanel };
