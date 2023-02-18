import dotenv from 'dotenv'
dotenv.config()
import fetch from 'node-fetch';
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
        if (contentMsg.startsWith("..")) {

            let isServer = (contentMsg.startsWith("...") && message.guild) ? true : false ;

            const user = isServer ? message.guild : message.author
            contentMsg = isServer ? contentMsg.slice(`...`.length) : contentMsg.slice(`..`.length);
            if (contentMsg.startsWith(" ")) contentMsg = contentMsg.slice(` `.length);
            if (message.author.bot || contentMsg.startsWith(".") || contentMsg == "") {
                return;
            }

            console.log("----Direct Message---")
            console.log("Date    : " + new Date())
            console.log("UserId  : " + message.author.id)
            console.log("User    : " + message.author.username)
            if(isServer){
                console.log("guildId : " + message.guild.id)
                console.log("guild   : " + message.guild.name)
            }
            console.log("Message : " + message.content)
            console.log("--------------")

            if (contentMsg.toLowerCase() == "reset") {
                Conversations.resetConversation(user.id)
                user.send("ㄟ？！你...你是...誰？")
                return;
            }

            let conversationInfo = Conversations.getConversation(user.id);
            if (contentMsg.startsWith("-bid")) {
                contentMsg = contentMsg.slice(`-bid`.length);
                let [conversationId, parentMessageId] = contentMsg.split(";");
                conversationInfo = Conversations.getConversation(user.id, {
                    conversationId,
                    parentMessageId
                })
                console.log("--------------")
                console.log("重新載入")
                console.log("conversationId : " + conversationId)
                console.log("parentMessageId : " + parentMessageId)
                console.log("--------------")
                contentMsg = "妳還在嗎？"
            }
            console.log("conversationId : " + conversationInfo.conversationId)
            console.log("parentMessageId : " + conversationInfo.parentMessageId)
            console.log("--------------")
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
