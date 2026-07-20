import "dotenv/config";
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

/**
 * Registers the bot's slash commands to a single guild (instant availability).
 * Run once after changing commands: `npm run register`.
 */
const commands = [
  new SlashCommandBuilder()
    .setName("beta")
    .setDescription("Sign up for the RentYourTime beta with your email."),
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your email for the RentYourTime beta."),
  new SlashCommandBuilder()
    .setName("beta-setup")
    .setDescription("Post the beta sign-up panel in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("beta-count")
    .setDescription("Show how many people signed up for the beta.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("beta-export")
    .setDescription("Export collected beta emails as a CSV file.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  console.error("Missing DISCORD_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID in .env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

try {
  await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
    body: commands,
  });
  console.log(`✓ Registered ${commands.length} guild slash commands.`);
} catch (err) {
  console.error("Failed to register commands:", err);
  process.exit(1);
}
