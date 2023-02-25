import { REST, Routes, AttachmentBuilder } from 'discord.js'

import stableDiffusion from '../stablediffusion/stableDiffusion.js';
import Conversations from '../chatgpt/conversations.js'
import { askQuestion } from '../chatgpt/chatgpt.js';
import { generateInteractionReply } from './discord_helpers.js';

export const commands = [
    {
        name: 'set_key',
        description: '設定個人的 API-Key。這個 Key 只會用在你個人的對話中。',
        options: [
            {
                name: "API-Key",
                description: "你的 API-Key",
                type: 3,
                required: true
            }
        ]
    },
];

export async function initDiscordCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

export async function handle_interaction_set_key(interaction) {
    const user = interaction.user

    // Begin conversation
    let conversationInfo = Conversations.getConversation(user.id)
    const question = interaction.options.getString("question")
    await interaction.deferReply()

    try {
        askQuestion(question, async (content) => {
            generateInteractionReply(interaction,user,question,content)
        }, { conversationInfo })
    } catch (e) {
        console.error(e)
    }
}