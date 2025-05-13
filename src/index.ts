#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
/**
 * Wechaty - Conversational RPA SDK for Chatbot Makers.
 *  - https://github.com/wechaty/wechaty
 */
// https://stackoverflow.com/a/42817956/1123955
// https://github.com/motdotla/dotenv/issues/89#issuecomment-587753552
import 'dotenv/config.js';
import {
  Contact,
  Message,
  ScanStatus,
  WechatyBuilder,
  log,
  Room,
} from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import axios from 'axios';
import { FileBox } from 'file-box';
import fs from 'fs';

import { weatherPush, timeTexts, warningPush, weatherPushFunc, earthquakePush, holidayPush, dailyNewsPush } from './schedule-service/schedule-service.js';
import { DailyNewsService } from './daily-news-service/daily-news-service.js';

import { WeatherService } from './weather-query/weather-query.js';
import { PixivLookupService } from './pixiv-lookup/pixiv-lookup.js';
import { AnimeLookupService } from './anime-lookup/anime-lookup.js';
import { CalculatorService } from './calculator-service/calculator-service.js';
import { HolidayService } from './holiday-service/holiday-service.js';
import { AiPaintingService } from './ai-painting/ai-painting.js';
import { OpenAIService } from './openai/qwq-service.js';
import { EdgeGptService } from './openai/edgegpt-service.js';

const bot = WechatyBuilder.build({
  name: 'klee-bot',
  puppet: 'wechaty-puppet-wechat',
  puppetOptions: {
    uos: true  // 开启uos协议
  },
});

bot.on('scan', onScan);
bot.on('login', onLogin);
bot.on('logout', onLogout);
bot.on('message', onMessage);

bot.start()
  .then(() => log.info('Start', 'Bot Started.'))
  .catch(e => log.error('Start', e));

const weatherService = new WeatherService();
const pixivService = new PixivLookupService();
const animeService = new AnimeLookupService();
const calculatorService = new CalculatorService();
const aiPaintingService = new AiPaintingService();
const openaiService = new OpenAIService();
const edgegptService = new EdgeGptService();
// const holidayService = new HolidayService();

let lastPic: Message;
let lastMsg: Message;
let sameMsgCount: number = 0;

let toRecalledMsg: Message;

function onScan(qrcode: string, status: ScanStatus) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      encodeURIComponent(qrcode),
    ].join('');
    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl);

    qrcodeTerminal.generate(qrcode, { small: true });  // show qrcode on console

  } else {
    log.info('Scan Status', 'onScan: %s(%s)', ScanStatus[status], status);
  }
}

async function onLogin(user: Contact) {
  log.info('Login Status', '%s login', user);
  weatherPush(bot);
  timeTexts(bot);
  warningPush(bot);
  earthquakePush(bot);
  holidayPush(bot);
  dailyNewsPush(bot);
}

function onLogout(user: Contact) {
  log.info('Logout Status', '%s logout', user);
}

async function onMessage(msg: Message) {
  log.info('Receive Message', [msg.text(), msg.type().toString()]);
  const botName = `@${bot.currentUser.name()} `;
  if (msg.age() <= 60) {
    if (!msg.self()) {
      checkRepeatMsg(msg);
    }

    if (msg.self()) {
      toRecalledMsg = msg;
    }

    if (msg.type() === bot.Message.Type.Image) {
      saveImage(msg);
    }

    if (await msg.mentionSelf()) {
      const room = await msg.room();
      if (!room) {
        throw new Error('Should never reach here: a mention message must in a room');
      }
      if (msg.text().includes('搜图')) {
        searchPixiv(lastPic);
      } else if (msg.text().includes('查番剧')) {
        searchAnime(lastPic);
      } else if (msg.text().includes('油价')) {
        queryFurlPrice(msg, room);
      } else if (msg.text().slice(msg.text().indexOf(botName) + botName.length) == '' || msg.text().slice(msg.text().indexOf(botName) + botName.length) == ' ') {
        rainbowFart(msg, room);
      } else {
        if (!msg.self()) {
          // if (msg.text().includes('图中') || msg.text().includes('图片中') || msg.text().includes('图里') || msg.text().includes('图片里') ||
          //   msg.text().includes('照片中') || msg.text().includes('照片里') ||
          //   msg.text().includes('截图中') || msg.text().includes('截图里') ||
          //   msg.text().includes('描述一下图片') || msg.text().includes('描述图片') ) {
          //   openaiService.analysisPic(msg, botName, lastPic);
          // } else {
            openaiService.getResponse(msg, botName);
          // }
        }
      }
    }

    if (msg.text() === 'ding') {
      await msg.say('dong');
    }

    if (msg.text() === '太笨了') {
      await msg.say('你才笨');
    }

    if (msg.text() === '很聪明') {
      await msg.say('确实');
    }

    if (msg.text() === '加班' || msg.text() === '在加') {
      workHard(msg);
    }

    if (msg.text() === '测试天气推送') {
      if (await msg.room()) {
        weatherPushFunc('徐州', [msg.room()]);
      }
    }

    if (msg.text() === '/测试节假日') {
      if (await msg.room()) {
        const holidayService = new HolidayService();
        try {
          const res = await holidayService.getHoliday();
          if (res !== 'null') {
            await msg.say(res);
          }
        } catch (error) {
          console.log('Schedule runs failed\n', error)
        }
      }
    }

    // if (msg.text().startsWith('/recall')) {
    //   if (toRecalledMsg) {
    //     try {
    //       await toRecalledMsg.recall();
    //     } catch (error) {
    //       console.log(error);
    //       await msg.say('君子一言驷马难追');
    //     }
    //   }
    // }

    // if (msg.text().startsWith('/ai ')) {
    //   edgegptService.getPainting(msg);
    // }

    if (msg.text().startsWith('/testnews')) {
      getNews(msg);
    }

    if (msg.text().startsWith('/地震')) {
      try {
        await axios.get('https://api.wolfx.jp/cenc_eqlist.json').then(
          res => {
            if (res.data && res.data['No1']) {
              try {
                let eqObj = res.data['No1'];
                if (eqObj && eqObj.latitude && eqObj.longitude && eqObj.magnitude && eqObj.location && eqObj.time && eqObj.depth) {
                  let date = new Date(eqObj.time);
                  let script =
                    `北京时间${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${date.getHours()}时${date.getMinutes()}分${date.getSeconds()}秒，位于 (${eqObj.latitude}, ${eqObj.longitude}) 的${eqObj.location}发生${eqObj.magnitude}级地震，震源深度${eqObj.depth}千米`;
                  msg.say(script);
                }
              } catch (error) {
                console.log(error);
              }
            }
          }
        ).catch(
          err => {
            console.log(err);
          }
        )
      } catch (error) {
        console.log(error + '');
      }
    }

    if (msg.text().startsWith('/hi ')) {
      try {
        const room = msg.room();
        if (room) {
          const contact = msg.talker();
          let content = msg.text();
          const request = content.replace('/hi ', '');
          // await chatgptReply(room, contact, request);
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (msg.text().indexOf('今天天气') !== -1) {
      const cityIndex = msg.text().indexOf('今天天气');
      if (cityIndex !== -1 && cityIndex === msg.text().length - 4) {
        await weatherService.getTodayWeather(msg.text().slice(0, cityIndex)).then(
          res => {
            msg.say(res);
          }
        ).catch(
          err => {
            msg.say(err + '');
          }
        )
      }
    } else if (msg.text().indexOf('明天天气') !== -1) {
      const cityIndex = msg.text().indexOf('明天天气');
      if (cityIndex !== -1 && cityIndex === msg.text().length - 4) {
        await weatherService.getThreeDaysWeather(msg.text().slice(0, cityIndex), '明天').then(
          res => {
            msg.say(res);
          }
        ).catch(
          err => {
            msg.say(err + '');
          }
        )
      }
    } else if (msg.text().indexOf('后天天气') !== -1) {
      const cityIndex = msg.text().indexOf('后天天气');
      if (cityIndex !== -1 && cityIndex === msg.text().length - 4) {
        await weatherService.getThreeDaysWeather(msg.text().slice(0, cityIndex), '后天').then(
          res => {
            msg.say(res);
          }
        ).catch(
          err => {
            msg.say(err + '');
          }
        )
      }
    } else if (msg.text().indexOf('天气') !== -1) {
      const cityIndex = msg.text().indexOf('天气');
      if (cityIndex !== -1 && cityIndex === msg.text().length - 2) {
        await weatherService.getWeather(msg.text().slice(0, cityIndex)).then(
          res => {
            msg.say(res);
          }
        ).catch(
          err => {
            msg.say(err + '');
          }
        )
      }
    }

    const calculateIndex = msg.text().indexOf('计算');
    if (calculateIndex !== -1 && calculateIndex === 0) {
      calculatorService.calculator(msg);
    }
  }
}

// Custom functions

function checkRepeatMsg(msg: Message) {
  if (lastMsg) {
    if (lastMsg.text() === msg.text()) {
      console.log('same msg');
      sameMsgCount += 1;
      if (sameMsgCount === 2) {
        let room = msg.room();
        if (room) {
          msg.forward(room).catch(
            err => {
              console.log(err + '');
            }
          )
        }
        sameMsgCount = -1;
      }
    } else {
      lastMsg = msg;
      sameMsgCount = 0;
    }
  } else {
    lastMsg = msg;
    sameMsgCount = 0;
  }
}

async function saveImage(msg: Message) {
  lastPic = msg;
  const file = await msg.toFileBox();
  if (file) {
    await file.toFile('lastpic.png');
  } else {
    throw new Error("File is null");
  }
}

async function searchPixiv(msg: Message) {
  if (lastPic) {
    try {
      await pixivService.getImg(msg).then(
        res => {
          msg.say(res);
        }
      ).catch(
        err => {
          msg.say(err + '');
        }
      )
    } catch (error) {
      msg.say('可莉不知道哦');
    }
  } else {
    msg.say('可莉把图片弄丢了');
  }
}

async function searchAnime(msg: Message) {
  if (lastPic) {
    try {
      await animeService.getImg(msg).then(
        res => {
          msg.say(res);
        }
      ).catch(
        err => {
          msg.say(err + '');
        }
      )
    } catch (error) {
      msg.say('可莉不知道哦');
    }
  } else {
    msg.say('可莉把图片弄丢了');
  }
}

async function rainbowFart(msg: Message, room: Room) {
  const who = msg.talker();
  axios.get('https://api.shadiao.pro/chp').then(
    res => {
      room.say(res.data.data.text, who);
    }
  ).catch(
    err => {
      room.say('干啥', who);
    }
  )
}

async function workHard(msg: Message) {
  const apiKey = process.env.TIANAPI_API_KEY;
  axios.get(`https://apis.tianapi.com/dgryl/index?key=${apiKey}`).then(
    res => {
      console.log(res);
      msg.say(res.data.result.content);
    }
  ).catch(
    err => {
      console.log(err);
    }
  )
}

async function queryFurlPrice(msg: Message, room: Room) {
  const cityIndex = msg.text().indexOf('油价');
  const who = msg.talker();
  if (cityIndex !== -1 && cityIndex === msg.text().length - 2) {
    const name = msg.text().slice(10, cityIndex);
    await axios.get(encodeURI(`https://apis.tianapi.com/oilprice/index?key=${process.env.TIANAPI_API_KEY}&prov=${name}`)).then(
      res => {
        const price = res.data.result;
        if (price) {
          let priceText =
            `${name}油价：
            零号柴油：${price.p0}
            89号汽油：${price.p89}
            92号汽油：${price.p92}
            95号汽油：${price.p95}
            98号汽油：${price.p98}
            更新时间：${price.time}`
          room.say(priceText, who);
        }
      }
    ).catch(
      err => {
        room.say('可莉不知道哦', who);
      }
    )
  }
}

async function getNews(msg: Message) {
  const dailyNewsService = new DailyNewsService();
  dailyNewsService.getNews().then(
    result => {
      console.log('获取新闻中')
      fs.stat('news.png', async (err) => {
        if (!err) {
          console.log('图片存在');
          try {
            await msg.say(FileBox.fromFile('news.png'));
          } catch (error) {
            console.log(error);
          }
        } else if (err.code === 'ENOENT') {
          console.log('news不存在');
        }
      });
    }).catch(error => {
      console.error(error);
    });
}