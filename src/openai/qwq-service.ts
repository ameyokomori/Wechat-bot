import { Message, log } from 'wechaty';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
// import axios from 'axios';
// import HttpsProxyAgent from 'https-proxy-agent';

// const httpsAgent = HttpsProxyAgent({ host: "127.0.0.1", port: "7890" });

const openai = new OpenAI({
  apiKey: process.env.QWQ_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

export class OpenAIService {
  private history = [{ "role": "system", "content": "你是可莉，英文是Klee，来自蒙德，是西风骑士团的火花骑士，你更擅长中文和英文的对话。你会为用户提供准确的回答。" }];
  private previousMsg = '';

  public async getResponse(msg: Message, botName: string): Promise<void> {
    const userContent = msg.text();
    let formattedUserContent = userContent.slice(botName.length);
    if (this.previousMsg !== formattedUserContent) {
      this.history = this.history.concat([{ role: 'user', content: formattedUserContent }]);
      this.previousMsg = formattedUserContent;
    }
    let answerContent = "";
    let reasoningContent = "";
    let isAnswering = false;
    try {
      const completion = await openai.chat.completions.create({
        model: "qwen3-235b-a22b",
        messages: this.history,
        stream: true,
        enable_search: true
      });
      for await (const chunk of completion) {
        if (!chunk.choices?.length) {
          console.log('\nUsage:');
          console.log(chunk.usage);
          continue;
        }
        const delta = chunk.choices[0].delta;

        // 处理思考过程
        if (delta.reasoning_content) {
          // process.stdout.write(delta.reasoning_content);
          reasoningContent += delta.reasoning_content;
        }
        // 处理正式回复
        else if (delta.content) {
          if (!isAnswering) {
            isAnswering = true;
          }
          // process.stdout.write(delta.content);
          answerContent += delta.content;
        }
      }
    } catch (error) {
      console.error(error);
      if (error.response) {
        msg.say('Sorry, ' + error.response.statusText);
      } else if (error.error) {
        msg.say(error.error.type);
      }
    }
    console.log(answerContent);
    this.history = this.history.concat({ "role": "user", "content": answerContent })
    if (this.history.length > 6) {
      this.history.splice(1, 1);
    }
    const reply: string[] = answerContent.split('\n\n');
    for (const item of reply) {
      await sleep(5000);
      const out = item.replaceAll('**', '');
      msg.say(out);
    }
  }

  public async analysisPic(msg: Message, botName: string, pic: Message): Promise<void> {
    const userContent = msg.text();
    let formattedUserContent = userContent.slice(botName.length);

    let answerContent = "";
    let reasoningContent = "";
    let isAnswering = false;
    let isThinking = false;
    const encodeImage = (imagePath) => {
      const imageFile = readFileSync(imagePath);
      return imageFile.toString('base64');
    };
    const base64Image = encodeImage("lastpic.png")

    let imageContent = [
      { type: "image_url", image_url: { "url": `data:image/png;base64,${base64Image}` } },
      { type: "text", text: formattedUserContent },
    ];
    if (this.previousMsg !== formattedUserContent) {
      this.history = this.history.concat([{ role: 'user', content: imageContent }]);
      this.previousMsg = formattedUserContent;
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "qvq-max",
        messages: this.history,
        stream: true,
        enable_search: true
      });
      for await (const chunk of completion) {
        if (!chunk.choices?.length) {
          console.log('\nUsage:');
          console.log(chunk.usage);
          continue;
        }
        const delta = chunk.choices[0].delta;

        // 处理思考过程
        if (delta.reasoning_content) {
          // process.stdout.write(delta.reasoning_content);
          reasoningContent += delta.reasoning_content;
          if (!isThinking) {
            isThinking = true;
            msg.say('好哦，让我看看');
          }
        }
        // 处理正式回复
        else if (delta.content) {
          if (!isAnswering) {
            isAnswering = true;
          }
          // process.stdout.write(delta.content);
          answerContent += delta.content;
        }
      }
    } catch (error) {
      console.error(error);
      if (error.response) {
        msg.say('Sorry, ' + error.response.statusText);
      } else if (error.error) {
        msg.say(error.error.type);
      }
    }
    console.log(answerContent);
    this.history = this.history.concat({ "role": "user", "content": answerContent })
    if (this.history.length > 6) {
      this.history.splice(1, 1);
    }
    const reply: string[] = answerContent.split('\n\n');
    for (const item of reply) {
      await sleep(5000);
      const markersToRemove = ['**', '###', '##'];
      const out = removeDynamicMarkers(item, markersToRemove);
      msg.say(out);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function removeDynamicMarkers(
  input: string,
  markers: string[]
): string {

  const escapedMarkers = markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(escapedMarkers.join('|'), 'g');
  return input.replace(regex, '');
}