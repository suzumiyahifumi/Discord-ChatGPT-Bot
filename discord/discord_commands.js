/* jshint esversion: 9 */
import { REST, Routes } from 'discord.js';

import Keyv from 'keyv';
const keyv_secret = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'users_api_key' });

export const commands = [
	{
		name: 'set_key',
		description: '設定個人的 API-Key。這個 Key 只會用在你個人的對話中。',
		options: [
			{
				name: "API_Key",
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

export async function handle_interaction_set_key(interaction) {
	const user = interaction.user;
   
	try {
		const api_key = interaction.options.getString("API_Key");
		await keyv_secret.set(`${interaction.user.id}`, api_key);
		user.send(
			"~~                                                                                                                                                 ~~" +
			"**【 通知 】**\n" +
			"已經完成 `API-Key` 設定！" +
			"您正在使用的 `API-Key` ： ||" + api_key + "||" +
			"~~                                                                                                                                                 ~~");
	} catch (e) {
		console.error(e);
	}
}