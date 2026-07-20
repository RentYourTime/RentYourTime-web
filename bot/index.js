import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";
import { addBetaTester, allBetaTesters, countBetaTesters, isValidEmail } from "./db.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const SIGNAL = 0x00e676;
const OWNER_ID = process.env.DISCORD_OWNER_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/** DM the configured owner about a new beta signup. Never throws. */
async function notifyOwner(email, user) {
  if (!OWNER_ID) return;
  try {
    const owner = await client.users.fetch(OWNER_ID);
    const embed = new EmbedBuilder()
      .setColor(SIGNAL)
      .setTitle("\u{1F195} New beta signup")
      .addFields(
        { name: "Email", value: email },
        { name: "From", value: `${user.username} (<@${user.id}>)` }
      )
      .setTimestamp();
    await owner.send({ embeds: [embed] });
  } catch (err) {
    // Owner may have DMs closed or not share a server with the bot.
    console.warn("Could not DM owner about new signup:", err.message);
  }
}

/** Private modal asking the user for their email. */
function emailModal() {
  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Your email")
    .setPlaceholder("you@email.com")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(254);
  return new ModalBuilder()
    .setCustomId("beta_modal")
    .setTitle("Join the RentYourTime beta")
    .addComponents(new ActionRowBuilder().addComponents(email));
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✓ Logged in as ${c.user.tag} — ${countBetaTesters()} beta testers so far`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---- slash commands ----
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case "beta":
        case "register":
          await interaction.showModal(emailModal());
          return;

        case "beta-setup": {
          const embed = new EmbedBuilder()
            .setColor(SIGNAL)
            .setTitle("Become a RentYourTime beta tester")
            .setDescription(
              "Tap the button below and drop your email to get early access.\n" +
                "We’ll only use it to invite you to the beta — your email stays private."
            );
          const button = new ButtonBuilder()
            .setCustomId("beta_join")
            .setLabel("Join the beta")
            .setEmoji("\u{1F680}")
            .setStyle(ButtonStyle.Success);
          await interaction.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(button)],
          });
          await interaction.reply({
            content: "✅ Beta sign-up panel posted in this channel.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        case "beta-count":
          await interaction.reply({
            content: `\u{1F4CB} **${countBetaTesters()}** people have signed up for the beta.`,
            flags: MessageFlags.Ephemeral,
          });
          return;

        case "beta-export": {
          const rows = allBetaTesters();
          const csv =
            "email,discord_username,created_at\n" +
            rows
              .map((r) => [r.email, r.discord_username, r.created_at].map(csvEscape).join(","))
              .join("\n");
          const file = new AttachmentBuilder(Buffer.from(csv, "utf8"), {
            name: "beta-testers.csv",
          });
          await interaction.reply({
            content: `\u{1F4CE} ${rows.length} beta emails attached.`,
            files: [file],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      return;
    }

    // ---- button on the sign-up panel ----
    if (interaction.isButton() && interaction.customId === "beta_join") {
      await interaction.showModal(emailModal());
      return;
    }

    // ---- modal submission ----
    if (interaction.isModalSubmit() && interaction.customId === "beta_modal") {
      const email = interaction.fields.getTextInputValue("email").trim().toLowerCase();
      if (!isValidEmail(email)) {
        await interaction.reply({
          content: "⚠️ That doesn’t look like a valid email. Please try again.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const { added } = addBetaTester(email, interaction.user.id, interaction.user.username);
      await interaction.reply({
        content: added
          ? "\u{1F389} You’re on the beta list! We’ll email you when it’s your turn."
          : "\u{1F44D} You’re already on the beta list — see you soon.",
        flags: MessageFlags.Ephemeral,
      });
      if (added) await notifyOwner(email, interaction.user);
      return;
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "Something went wrong. Please try again.", flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
});

client.login(token);
