import axios from 'axios';
import type { Provider, GPTRequest } from '../utils/types';
import readline from 'readline';

class ClovingGPT {
  private provider: Provider;
  private model: string;
  private apiKey: string;

  constructor() {
    const clovingModel = process.env.CLOVING_MODEL;
    this.apiKey = process.env.CLOVING_API_KEY || '';

    if (!clovingModel || !this.apiKey) {
      throw new Error("CLOVING_MODEL and CLOVING_API_KEY environment variables must be set");
    }

    const [provider, model] = clovingModel.split(':');
    this.provider = provider as Provider;
    this.model = model;
  }

  private getEndpoint(): string {
    switch (this.provider) {
      case 'openai':
        return `https://api.openai.com/v1/engines/${this.model}/completions`;
      case 'claude':
        return `https://api.anthropic.com/v1/claude/${this.model}`;
      case 'gpt4all':
        return `https://api.gpt4all.io/v1/models/${this.model}/completions`;
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  private async askUserToConfirm(prompt: string, message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  public async generateText(request: GPTRequest): Promise<string> {
    const shouldShowPrompt = await this.askUserToConfirm(request.prompt, 'Do you want to see the prompt before it is sent to the GPT? [yN]: ');

    if (shouldShowPrompt) {
      console.log('Prompt being sent to GPT:', request.prompt);
      const shouldContinue = await this.askUserToConfirm(request.prompt, 'Do you still want to continue? [Yn]: ');
      if (!shouldContinue) {
        console.log('Operation cancelled by the user.');
        return '';
      }
    }

    const endpoint = this.getEndpoint();

    const response = await axios.post(endpoint, {
      model: this.model,
      prompt: request.prompt,
      max_tokens: request.maxTokens || 100,
      temperature: request.temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    switch (this.provider) {
      case 'openai':
        return response.data.choices[0].text;
      case 'claude':
        return response.data.completion;
      case 'gpt4all':
        return response.data.text;
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }
}

export default ClovingGPT;
