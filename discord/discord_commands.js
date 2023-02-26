/* jshint esversion: 9 */
import { REST, Routes } from 'discord.js';
import Conversations from '../chatgpt/conversations.js';

import Keyv from 'keyv';
//const keyv_secret = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'users_api_key' });

export const commands = [
	{
		name: 'set_key',
		description: '設定個人的 API-Key。這個 Key 只會用在你個人的對話中。',
		options: [
			{
				name: "api_key",
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
		await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID.toString()), { body: commands });
		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
}

export async function handle_interaction_set_key(interaction, keyv) {
	const user = interaction.user;
   
	try {
		console.log("interaction.user: ", interaction.user)
		const api_key = interaction.options.getString("api_key");
		let insert = await keyv.set(`${interaction.user.id}`, api_key);
		Conversations.resetConversation(interaction.user.id);
		console.log("insert", insert)
		user.send(
			"~~                                                                                                                                                 ~~\n" +
			"**【 通知 】**\n" +
			"已經完成 `API-Key` 設定！\n" +
			"您正在使用的 `API-Key` ： ||" + api_key + "||\n" +
			"~~                                                                                                                                                 ~~");
	} catch (e) {
		console.error(e);
	}
}