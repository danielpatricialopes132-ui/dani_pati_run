import axios from 'axios';
import { config } from '../config';

export interface SendMessageOptions {
  delay?: number;
  presence?: 'composing' | 'recording';
}

export class EvolutionApiService {
  private baseUrl: string;
  private instanceName: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.evolution.baseUrl;
    this.instanceName = config.evolution.instanceName;
    this.apiKey = config.evolution.apiKey;
  }

  /**
   * Envia mensagem de texto via Evolution API
   * Endpoint: POST /message/sendText/{instance}
   */
  async sendTextMessage(
    number: string,
    text: string,
    options: SendMessageOptions = { delay: 1200, presence: 'composing' }
  ): Promise<boolean> {
    const cleanNumber = number.replace(/\D/g, '');
    const url = `${this.baseUrl}/message/sendText/${this.instanceName}`;

    const payload = {
      number: cleanNumber,
      options: {
        delay: options.delay ?? 1200,
        presence: options.presence ?? 'composing',
      },
      text: text,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        timeout: 20000,
      });

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`[EvolutionApi] Falha ao enviar mensagem para ${cleanNumber}: ${errorMsg}`);
      return false;
    }
  }
}

export const evolutionApi = new EvolutionApiService();
