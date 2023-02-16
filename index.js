import dotenv from 'dotenv'
dotenv.config()

import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js'
import { initChatGPT, askQuestion } from './chatgpt/chatgpt.js'
import { initDiscordCommands, handle_interaction_ask, handle_interaction_image } from './discord/discord_commands.js'
import { splitAndSendResponse, MAX_RESPONSE_CHUNK_LENGTH } from './discord/discord_helpers.js'
import Conversations from './chatgpt/conversations.js'

async function main() {
    await initChatGPT().catch(e => {
        console.error(e)
        process.exit()
    })

   // await initDiscordCommands()

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildIntegrations,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageTyping,
            GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel]
    });

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        console.log(new Date())
    });

    client.on("messageCreate", async message => {
        let contentMsg = message.content.toLowerCase();
        console.log(contentMsg)
        if (contentMsg.startsWith("..")) {

            contentMsg = contentMsg.slice(`..`.length);
            if (contentMsg.startsWith(" ")) contentMsg = contentMsg.slice(` `.length);
            console.log(contentMsg)
            if (message.author.bot) {
                return;
            }
            const user = message.author

            console.log("----Direct Message---")
            console.log("Date    : " + new Date())
            console.log("UserId  : " + user.id)
            console.log("User    : " + user.username)
            console.log("Message : " + message.content)
            console.log("--------------")

            if (contentMsg.toLowerCase() == "reset") {
                Conversations.resetConversation(user.id)
                user.send("ㄟ？！你...你是...誰？")
                return;
            }

            let conversationInfo = Conversations.getConversation(user.id)
            try {
                let sentMessage = await message.reply("嗯...讓我想想...")
                askQuestion(contentMsg, async (response) => {
                    if (response.length >= MAX_RESPONSE_CHUNK_LENGTH) {
                        splitAndSendResponse(response, user)
                    } else {
                        await sentMessage.edit(response)
                    }
                }, { conversationInfo })
            } catch (e) {
                console.error(e)
            }
        }
    })


    client.login(process.env.DISCORD_BOT_TOKEN);
}

main()
