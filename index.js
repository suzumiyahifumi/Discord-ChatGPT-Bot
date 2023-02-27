/* jshint esversion: 9 */
import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import { initChatGPT, askQuestion } from './chatgpt/chatgpt.js';
import { initDiscordCommands, handle_interaction_set_key } from './discord/discord_commands.js';
import { splitAndSendResponse, MAX_RESPONSE_CHUNK_LENGTH } from './discord/discord_helpers.js';
import Conversations from './chatgpt/conversations.js';
import { EmbedBuilder  } from 'discord.js';
import Keyv from 'keyv';
const keyv = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'keyv' });
const keyv_message = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'gpt_message' });
const keyv_user = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'user_status' });
const keyv_secret = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'users_api_key' });

async function main() {
	await initChatGPT({
		messageStore: keyv
	}).catch(e => {
		console.error(e);
		process.exit();
	});

	await initDiscordCommands();

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
		console.log(new Date());
	});

	client.on("messageCreate", async message => {
		let contentMsg = message.content.toLowerCase();
		if (contentMsg.startsWith("--") || contentMsg.startsWith("---")) {
			let isServer = (contentMsg.startsWith("---") && message.guild) ? true : false ;
			contentMsg = isServer ? contentMsg.slice(`---`.length) : contentMsg.slice(`--`.length);
			const user = isServer ? message.guild : message.author
			if(contentMsg != ""){
				try{
					let msg = await keyv_message.get(contentMsg);
					if(msg!=undefined){
						let conversationInfo = await Conversations.getConversation(user.id, {
							conversationId: msg.conversationId,
							parentMessageId: msg.parentMessageId
						});
						console.log("--------------");
						console.log("重新載入");
						console.log("conversationId : " + msg.conversationId);
						console.log("parentMessageId: " + msg.parentMessageId);
						console.log("--------------");
						await message.reply(getEmbed(msg.gpt_content, msg.message_id, false, "已載入對話： `" + msg.message_id + "`\n對話內容："));
						return;
					} else {
						await message.reply("哇！出錯了！無法載入此對話： `" + msg.message_id + "`！");
					}
				}
				catch(err){
					await message.reply("哇！出錯了！無法載入此對話： `" + contentMsg + "`！");
				}
			} else {
				await message.reply("哇！出錯了！無法載入此對話： `" + contentMsg + "`！");
			}
		}

		if (contentMsg.startsWith("..") || contentMsg.startsWith("...")) {

			let isServer = (contentMsg.startsWith("...") && message.guild) ? true : false ;

			const user = isServer ? message.guild : message.author
			contentMsg = isServer ? contentMsg.slice(`...`.length) : contentMsg.slice(`..`.length);
			if (contentMsg.startsWith(" ")) contentMsg = contentMsg.slice(` `.length);
			if (message.author.bot || contentMsg.startsWith(".") || contentMsg == "") {
				return;
			}

			console.log("----Direct Message---");
			console.log("Date    : " + new Date());
			console.log("UserId  : " + message.author.id);
			console.log("User    : " + message.author.username);
			if(isServer){
				console.log("guildId : " + message.guild.id);
				console.log("guild   : " + message.guild.name);
			}
			console.log("Message : " + message.content);
			console.log("--------------");

			if (contentMsg.toLowerCase() == "reset") {
				await Conversations.resetConversation(user.id);
				await keyv_user.delete(user.id)
				user.send("ㄟ？！你...你是...誰？");
				return;
			}

			let conversationInfo = await Conversations.getConversation(user.id);
		//	console.log(conversationInfo)
			if (conversationInfo.err != undefined) {
				await message.reply(conversationInfo.err);
				return;
			}

			let variants = false;
			if (message.reference) {
				try{
					let message_k = (await message.fetchReference()).embeds[0].data.footer.text;
					let message_id = message_k.slice(`--`.length);
					let msg_ref = await keyv_message.get(message_id);
					if (msg_ref != undefined) {
						conversationInfo = await Conversations.getConversation(user.id, {
							conversationId: msg_ref.conversationId,
							parentMessageId: msg_ref.parentMessageId
						});
					}
					variants = "已切換 `對話分枝` ...";
					console.log(`已經回復對話！`);
				}
				catch(err) {
					return;
				}
			}

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
                console.log("parentMessageId: " + parentMessageId)
                console.log("--------------")
                await message.reply("已經回復對話！");
                return
            }

			console.log("conversationId : " + conversationInfo.conversationId);
			console.log("parentMessageId: " + conversationInfo.parentMessageId);
			console.log("--------------");
			try {
				let sentMessage = await message.reply("嗯...讓我想想...");
				askQuestion(contentMsg, async (response) => {
					if (response.length >= MAX_RESPONSE_CHUNK_LENGTH) {
						splitAndSendResponse(response, user);
					} else {
						let conversation = await Conversations.getConversation(user.id);
						let msg = await sentMessage.edit(getEmbed(response, sentMessage.id, variants));
						await keyv_message.set(`${msg.id}`, {
							message_id: sentMessage.id,
							parentMessageId: conversation.parentMessageId,
							conversationId: conversation.conversationId,
							author_id: user.id,
							time: new Date(),
							gpt_content: response,
							author_content: contentMsg
						});
						await keyv_user.set(`${user.id}`, {
							message_id: sentMessage.id,
							parentMessageId: conversation.parentMessageId,
							conversationId: conversation.conversationId,
							author_id: user.id,
							time: new Date()
						});
					}
				}, { conversationInfo });
			} catch (e) {
				console.error(e);
			}
		}
	});

	function getEmbed(message, message_id, variants, msg = false) {
		let embed = new EmbedBuilder()
			.setDescription(message)
			.setFooter({
				text: `--${message_id}`
			});
		return {
			content: (variants!=false)? variants : (msg!=false)? msg : "",
			embeds: [embed]
		};
	}

	client.on("interactionCreate", async interaction => {
		switch (interaction.commandName) {
			case "set_key":
				handle_interaction_set_key(interaction, keyv_secret);
				break;
		}
	});


	client.login(process.env.DISCORD_BOT_TOKEN);
}

main();
