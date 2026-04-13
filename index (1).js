import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Partials,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const auditLogConfigPath = join(appDirectory, "data", "audit-log-channels.json");
const warningsPath = join(appDirectory, "data", "warnings.json");

if (!token) {
  throw new Error("DISCORD_TOKEN is missing. Add your Discord bot token as a secret named DISCORD_TOKEN.");
}

async function loadAuditLogChannels() {
  try {
    const file = await readFile(auditLogConfigPath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function saveAuditLogChannels(channels) {
  await mkdir(dirname(auditLogConfigPath), { recursive: true });
  await writeFile(auditLogConfigPath, `${JSON.stringify(channels, null, 2)}\n`);
}

const auditLogChannels = await loadAuditLogChannels();

async function loadWarnings() {
  try {
    const file = await readFile(warningsPath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function saveWarnings(warnings) {
  await mkdir(dirname(warningsPath), { recursive: true });
  await writeFile(warningsPath, `${JSON.stringify(warnings, null, 2)}\n`);
}

const warnings = await loadWarnings();

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is online"),
  new SlashCommandBuilder()
    .setName("server")
    .setDescription("Show information about this server"),
  new SlashCommandBuilder()
    .setName("about")
    .setDescription("Learn what this bot can do"),
  new SlashCommandBuilder()
    .setName("audit-log")
    .setDescription("Set the channel used for moderation audit logs")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The existing channel where moderation logs should be posted")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member and save it to their warning history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for this warning")
        .setMaxLength(512)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warning history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member whose warnings you want to view")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show account, server, role, and warning details for a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to look up")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Remove all warnings from a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member whose warnings should be removed")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for clearing these warnings")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("removewarning")
    .setDescription("Remove one warning from a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member whose warning should be removed")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("number")
        .setDescription("The warning number from /warnings, where 1 is the most recent")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for removing this warning")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete recent messages from this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How many recent messages to delete")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for this purge")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set the slowmode cooldown for this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("Cooldown in seconds. Use 0 to turn slowmode off")
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for changing slowmode")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock this channel so regular members cannot send messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for locking this channel")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock this channel so regular members can send messages again")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for unlocking this channel")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to kick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for this kick")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to ban")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for this ban")
        .setMaxLength(512)
    ),
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily timeout a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The member to timeout")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("How many minutes the timeout should last")
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for this timeout")
        .setMaxLength(512)
    ),
].map((command) => command.toJSON());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel, Partials.Message],
});

function formatReason(interaction, reason) {
  const moderator = interaction.user.tag ?? interaction.user.username;
  return reason ? `${reason} — by ${moderator}` : `Action taken by ${moderator}`;
}

async function getTargetMember(interaction) {
  const user = interaction.options.getUser("user", true);
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  return { user, member };
}

async function requireGuild(interaction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command only works inside a Discord server.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}

function isSelfAction(interaction, user) {
  return user.id === interaction.user.id || user.id === client.user?.id;
}

async function setAuditLogChannel(interaction) {
  if (!(await requireGuild(interaction))) {
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  if (!channel.isTextBased()) {
    await interaction.reply({
      content: "Please choose a channel where I can send messages.",
      ephemeral: true,
    });
    return;
  }

  auditLogChannels[interaction.guild.id] = channel.id;
  await saveAuditLogChannels(auditLogChannels);
  await interaction.reply({
    content: `Audit logs will now be posted in ${channel}.`,
    allowedMentions: { parse: [] },
    ephemeral: true,
  });
}

async function sendAuditLog(interaction, details) {
  const channelId = auditLogChannels[interaction.guild.id];

  if (!channelId) {
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    console.error(`Audit log channel ${channelId} is unavailable or is not text-based`);
    return;
  }

  const fields = [
    { name: "Action", value: details.action, inline: true },
    { name: "User", value: `${details.user.tag} (${details.user.id})`, inline: true },
    { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
    { name: "Reason", value: details.reason || "No reason provided", inline: false },
  ];

  if (details.duration) {
    fields.push({ name: "Duration", value: details.duration, inline: true });
  }

  if (details.warningCount) {
    fields.push({ name: "Total warnings", value: String(details.warningCount), inline: true });
  }

  if (details.clearedWarnings !== undefined) {
    fields.push({ name: "Cleared warnings", value: String(details.clearedWarnings), inline: true });
  }

  if (details.removedWarning) {
    fields.push({ name: "Removed warning", value: details.removedWarning.slice(0, 1024), inline: false });
  }

  const embed = new EmbedBuilder()
    .setTitle("Moderation audit log")
    .setColor(0x5865f2)
    .addFields(fields)
    .setTimestamp();

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
    console.error("Failed to send audit log", error);
  });
}

function getGuildWarnings(guildId) {
  if (!warnings[guildId]) {
    warnings[guildId] = {};
  }

  return warnings[guildId];
}

function getUserWarnings(guildId, userId) {
  const guildWarnings = getGuildWarnings(guildId);

  if (!guildWarnings[userId]) {
    guildWarnings[userId] = [];
  }

  return guildWarnings[userId];
}

async function sendMessageDeleteAuditLog(message) {
  const guild = message.guild;

  if (!guild) {
    return;
  }

  const channelId = auditLogChannels[guild.id];

  if (!channelId) {
    return;
  }

  const auditChannel = await client.channels.fetch(channelId).catch(() => null);

  if (!auditChannel?.isTextBased()) {
    console.error(`Audit log channel ${channelId} is unavailable or is not text-based`);
    return;
  }

  const author = message.author
    ? `${message.author.tag} (${message.author.id})`
    : "Unknown or uncached user";
  const deletedChannel = message.channelId ? `<#${message.channelId}>` : "Unknown channel";
  const content = message.content?.trim();
  const attachments = message.attachments?.size ?? 0;
  const fields = [
    { name: "Channel", value: deletedChannel, inline: true },
    { name: "Author", value: author, inline: true },
    { name: "Message ID", value: message.id, inline: true },
    {
      name: "Content",
      value: content ? content.slice(0, 1024) : "Unavailable. Enable Message Content Intent in the Discord Developer Portal to log message text.",
      inline: false,
    },
  ];

  if (attachments > 0) {
    fields.push({ name: "Attachments", value: String(attachments), inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle("Message deleted")
    .setColor(0xed4245)
    .addFields(fields)
    .setTimestamp();

  await auditChannel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
    console.error("Failed to send message delete audit log", error);
  });
}

async function sendPurgeAuditLog(interaction, details) {
  const channelId = auditLogChannels[interaction.guild.id];

  if (!channelId) {
    return;
  }

  const auditChannel = await client.channels.fetch(channelId).catch(() => null);

  if (!auditChannel?.isTextBased()) {
    console.error(`Audit log channel ${channelId} is unavailable or is not text-based`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Messages purged")
    .setColor(0xfee75c)
    .addFields([
      { name: "Channel", value: `${interaction.channel}`, inline: true },
      { name: "Deleted", value: String(details.deletedCount), inline: true },
      { name: "Requested", value: String(details.requestedCount), inline: true },
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: "Reason", value: details.reason || "No reason provided", inline: false },
    ])
    .setTimestamp();

  await auditChannel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
    console.error("Failed to send purge audit log", error);
  });
}

async function sendSlowmodeAuditLog(interaction, details) {
  const channelId = auditLogChannels[interaction.guild.id];

  if (!channelId) {
    return;
  }

  const auditChannel = await client.channels.fetch(channelId).catch(() => null);

  if (!auditChannel?.isTextBased()) {
    console.error(`Audit log channel ${channelId} is unavailable or is not text-based`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Slowmode updated")
    .setColor(0x57f287)
    .addFields([
      { name: "Channel", value: `${interaction.channel}`, inline: true },
      { name: "Cooldown", value: `${details.seconds} second${details.seconds === 1 ? "" : "s"}`, inline: true },
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: "Reason", value: details.reason || "No reason provided", inline: false },
    ])
    .setTimestamp();

  await auditChannel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
    console.error("Failed to send slowmode audit log", error);
  });
}

async function sendChannelLockAuditLog(interaction, details) {
  const channelId = auditLogChannels[interaction.guild.id];

  if (!channelId) {
    return;
  }

  const auditChannel = await client.channels.fetch(channelId).catch(() => null);

  if (!auditChannel?.isTextBased()) {
    console.error(`Audit log channel ${channelId} is unavailable or is not text-based`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("Channel permissions updated")
    .setColor(details.action === "Lock" ? 0xed4245 : 0x57f287)
    .addFields([
      { name: "Action", value: details.action, inline: true },
      { name: "Channel", value: `${interaction.channel}`, inline: true },
      { name: "Moderator", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: "Reason", value: details.reason || "No reason provided", inline: false },
    ])
    .setTimestamp();

  await auditChannel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
    console.error("Failed to send channel lock audit log", error);
  });
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await readyClient.application.commands.set(commands);
    console.log("Slash commands registered");
  } catch (error) {
    console.error("Failed to register slash commands", error);
  }
});

client.on(Events.MessageDelete, async (message) => {
  await sendMessageDeleteAuditLog(message);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    if (interaction.commandName === "ping") {
      await interaction.reply(`Pong! WebSocket latency is ${client.ws.ping}ms.`);
      return;
    }

    if (interaction.commandName === "server") {
      const guild = interaction.guild;

      if (!guild) {
        await interaction.reply("This command only works inside a Discord server.");
        return;
      }

      await interaction.reply({
        content: [
          `Server: ${guild.name}`,
          `Members: ${guild.memberCount}`,
          `Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        ].join("\n"),
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (interaction.commandName === "about") {
      await interaction.reply(
        "I am a Node.js Discord bot with slash commands. Try /ping, /server, /audit-log, /warn, /warnings, /userinfo, /clearwarnings, /removewarning, /purge, /slowmode, /lock, /unlock, /kick, /ban, or /timeout."
      );
      return;
    }

    if (interaction.commandName === "audit-log") {
      await setAuditLogChannel(interaction);
      return;
    }

    if (interaction.commandName === "warn") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const { user } = await getTargetMember(interaction);
      const reason = interaction.options.getString("reason", true);

      if (isSelfAction(interaction, user)) {
        await interaction.reply({ content: "That action is not allowed for this user.", ephemeral: true });
        return;
      }

      const userWarnings = getUserWarnings(interaction.guild.id, user.id);
      const warning = {
        id: `${Date.now()}-${interaction.id}`,
        reason,
        moderatorId: interaction.user.id,
        moderatorTag: interaction.user.tag,
        createdAt: new Date().toISOString(),
      };

      userWarnings.push(warning);
      await saveWarnings(warnings);
      await sendAuditLog(interaction, {
        action: "Warn",
        user,
        reason,
        warningCount: userWarnings.length,
      });
      await interaction.reply({
        content: `Warned ${user.tag}. They now have ${userWarnings.length} warning${userWarnings.length === 1 ? "" : "s"}.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (interaction.commandName === "warnings") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const user = interaction.options.getUser("user", true);
      const userWarnings = getUserWarnings(interaction.guild.id, user.id);

      if (userWarnings.length === 0) {
        await interaction.reply({
          content: `${user.tag} has no warnings.`,
          allowedMentions: { parse: [] },
          ephemeral: true,
        });
        return;
      }

      const recentWarnings = userWarnings.slice(-10).reverse();
      const lines = recentWarnings.map((warning, index) => {
        const timestamp = Math.floor(new Date(warning.createdAt).getTime() / 1000);
        return `${index + 1}. <t:${timestamp}:R> by ${warning.moderatorTag}: ${warning.reason}`;
      });

      await interaction.reply({
        content: [
          `${user.tag} has ${userWarnings.length} warning${userWarnings.length === 1 ? "" : "s"}.`,
          "",
          ...lines,
        ].join("\n").slice(0, 2000),
        allowedMentions: { parse: [] },
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "removewarning") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const user = interaction.options.getUser("user", true);
      const number = interaction.options.getInteger("number", true);
      const reason = interaction.options.getString("reason");
      const userWarnings = getUserWarnings(interaction.guild.id, user.id);

      if (userWarnings.length === 0) {
        await interaction.reply({
          content: `${user.tag} has no warnings to remove.`,
          allowedMentions: { parse: [] },
          ephemeral: true,
        });
        return;
      }

      if (number > Math.min(userWarnings.length, 10)) {
        await interaction.reply({
          content: `That warning number is not currently shown by /warnings. Choose a number from 1 to ${Math.min(userWarnings.length, 10)}.`,
          ephemeral: true,
        });
        return;
      }

      const actualIndex = userWarnings.length - number;
      const [removedWarning] = userWarnings.splice(actualIndex, 1);

      await saveWarnings(warnings);
      await sendAuditLog(interaction, {
        action: "Remove warning",
        user,
        reason,
        removedWarning: removedWarning.reason,
        warningCount: userWarnings.length,
      });
      await interaction.reply({
        content: `Removed warning #${number} from ${user.tag}. They now have ${userWarnings.length} warning${userWarnings.length === 1 ? "" : "s"}.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (interaction.commandName === "userinfo") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const user = interaction.options.getUser("user", true);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const userWarnings = getUserWarnings(interaction.guild.id, user.id);
      const roles = member
        ? member.roles.cache
          .filter((role) => role.id !== interaction.guild.id)
          .sort((first, second) => second.position - first.position)
          .map((role) => `${role}`)
          .slice(0, 10)
        : [];
      const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
      const joinedTimestamp = member?.joinedTimestamp
        ? Math.floor(member.joinedTimestamp / 1000)
        : null;

      const embed = new EmbedBuilder()
        .setTitle(`User info: ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(0x5865f2)
        .addFields([
          { name: "User", value: `${user} (${user.id})`, inline: false },
          { name: "Account created", value: `<t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)`, inline: true },
          {
            name: "Joined server",
            value: joinedTimestamp ? `<t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)` : "Not currently in this server",
            inline: true,
          },
          { name: "Warnings", value: String(userWarnings.length), inline: true },
          { name: "Roles", value: roles.length ? roles.join(", ").slice(0, 1024) : "No roles", inline: false },
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] }, ephemeral: true });
      return;
    }

    if (interaction.commandName === "clearwarnings") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason");
      const guildWarnings = getGuildWarnings(interaction.guild.id);
      const clearedWarnings = guildWarnings[user.id]?.length ?? 0;

      delete guildWarnings[user.id];
      await saveWarnings(warnings);
      await sendAuditLog(interaction, {
        action: "Clear warnings",
        user,
        reason,
        clearedWarnings,
      });
      await interaction.reply({
        content: `Cleared ${clearedWarnings} warning${clearedWarnings === 1 ? "" : "s"} from ${user.tag}.`,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (interaction.commandName === "purge") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      if (!interaction.channel?.isTextBased() || !("bulkDelete" in interaction.channel)) {
        await interaction.reply({
          content: "I can only purge messages in text channels where bulk delete is supported.",
          ephemeral: true,
        });
        return;
      }

      const amount = interaction.options.getInteger("amount", true);
      const reason = interaction.options.getString("reason");

      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await sendPurgeAuditLog(interaction, {
        requestedCount: amount,
        deletedCount: deleted.size,
        reason,
      });
      await interaction.editReply(
        `Purged ${deleted.size} message${deleted.size === 1 ? "" : "s"}. Messages older than 14 days are skipped by Discord.`
      );
      return;
    }

    if (interaction.commandName === "slowmode") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      if (!interaction.channel || !("setRateLimitPerUser" in interaction.channel)) {
        await interaction.reply({
          content: "I can only set slowmode in channels that support it.",
          ephemeral: true,
        });
        return;
      }

      const seconds = interaction.options.getInteger("seconds", true);
      const reason = interaction.options.getString("reason");

      await interaction.channel.setRateLimitPerUser(seconds, formatReason(interaction, reason));
      await sendSlowmodeAuditLog(interaction, { seconds, reason });
      await interaction.reply({
        content: seconds === 0
          ? "Slowmode is now off in this channel."
          : `Slowmode is now ${seconds} second${seconds === 1 ? "" : "s"} in this channel.`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === "lock") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      if (!interaction.channel || !("permissionOverwrites" in interaction.channel)) {
        await interaction.reply({
          content: "I can only lock channels that support permission overwrites.",
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("reason");
      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: false },
        { reason: formatReason(interaction, reason) }
      );
      await sendChannelLockAuditLog(interaction, { action: "Lock", reason });
      await interaction.reply({ content: "This channel is now locked.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "unlock") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      if (!interaction.channel || !("permissionOverwrites" in interaction.channel)) {
        await interaction.reply({
          content: "I can only unlock channels that support permission overwrites.",
          ephemeral: true,
        });
        return;
      }

      const reason = interaction.options.getString("reason");
      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: null },
        { reason: formatReason(interaction, reason) }
      );
      await sendChannelLockAuditLog(interaction, { action: "Unlock", reason });
      await interaction.reply({ content: "This channel is now unlocked.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "kick") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const { user, member } = await getTargetMember(interaction);

      if (!member) {
        await interaction.reply({ content: "I could not find that member in this server.", ephemeral: true });
        return;
      }

      if (isSelfAction(interaction, user)) {
        await interaction.reply({ content: "That action is not allowed for this user.", ephemeral: true });
        return;
      }

      if (!member.kickable) {
        await interaction.reply({
          content: "I cannot kick that member. Check my permissions and role position.",
          ephemeral: true,
        });
        return;
      }

      const providedReason = interaction.options.getString("reason");
      const reason = formatReason(interaction, providedReason);
      await member.kick(reason);
      await sendAuditLog(interaction, { action: "Kick", user, reason: providedReason });
      await interaction.reply({ content: `Kicked ${user.tag}.`, allowedMentions: { parse: [] } });
      return;
    }

    if (interaction.commandName === "ban") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const { user, member } = await getTargetMember(interaction);

      if (isSelfAction(interaction, user)) {
        await interaction.reply({ content: "That action is not allowed for this user.", ephemeral: true });
        return;
      }

      if (member && !member.bannable) {
        await interaction.reply({
          content: "I cannot ban that member. Check my permissions and role position.",
          ephemeral: true,
        });
        return;
      }

      const providedReason = interaction.options.getString("reason");
      const reason = formatReason(interaction, providedReason);
      await interaction.guild.members.ban(user.id, { reason });
      await sendAuditLog(interaction, { action: "Ban", user, reason: providedReason });
      await interaction.reply({ content: `Banned ${user.tag}.`, allowedMentions: { parse: [] } });
      return;
    }

    if (interaction.commandName === "timeout") {
      if (!(await requireGuild(interaction))) {
        return;
      }

      const { user, member } = await getTargetMember(interaction);
      const minutes = interaction.options.getInteger("minutes", true);

      if (!member) {
        await interaction.reply({ content: "I could not find that member in this server.", ephemeral: true });
        return;
      }

      if (isSelfAction(interaction, user)) {
        await interaction.reply({ content: "That action is not allowed for this user.", ephemeral: true });
        return;
      }

      if (!member.moderatable) {
        await interaction.reply({
          content: "I cannot timeout that member. Check my permissions and role position.",
          ephemeral: true,
        });
        return;
      }

      const providedReason = interaction.options.getString("reason");
      const reason = formatReason(interaction, providedReason);
      await member.timeout(minutes * 60 * 1000, reason);
      await sendAuditLog(interaction, {
        action: "Timeout",
        user,
        reason: providedReason,
        duration: `${minutes} minute${minutes === 1 ? "" : "s"}`,
      });
      await interaction.reply({
        content: `Timed out ${user.tag} for ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        allowedMentions: { parse: [] },
      });
    }
  } catch (error) {
    console.error("Failed to handle interaction", error);

    const message = "Something went wrong while running that command.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection", error);
});

try {
  await client.login(token);
} catch (error) {
  if (error?.code === RESTJSONErrorCodes.InvalidToken) {
    throw new Error("DISCORD_TOKEN is invalid. Check the bot token in your Discord Developer Portal.");
  }

  throw error;
}
