import schedule from 'node-schedule';
import fs from 'fs';

import {
	log,
	Room,
} from 'wechaty';
import { WechatyInterface } from 'wechaty/impls';
import axios from 'axios';
import { FileBox } from 'file-box';

const api = 'https://api.03c3.cn/zb/';
const api2 = 'https://api.vvhan.com/api/60s';

export async function dailyNewsPush(bot: WechatyInterface) {
	schedule.scheduleJob('00 30 8 * * *', async () => {
		const roomList = await bot.Room.findAll();
		try {
			await downloadImage(api2, 'news.png').then(
				res => {
					roomList.forEach(async room => {
						try {
							room.say(FileBox.fromFile('news.png'));
						} catch (error) {
							console.log(error);
						}
					})
				}
			).catch(
				err => {
					throw new Error(err);
				}
			)
		} catch (error) {
			console.log('Schedule runs failed\n', error)
		}
	})
}

export async function downloadImage(url, image_path) {
	axios({
		url,
		responseType: 'stream',
	}).then(
		response =>
			new Promise((resolve, reject) => {
				response.data
					.pipe(fs.createWriteStream(image_path))
					.on('finish', () => resolve(true))
					.on('error', e => reject(e));
			}),
	)
}