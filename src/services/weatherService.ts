import axios from 'axios';
import { config } from '../config';

export interface WeatherForecast {
  temp: number;
  tempMin: number;
  tempMax: number;
  description: string;
  humidity: number;
  rainProb: number;
  suggestion: string;
}

export class WeatherService {
  private apiKey: string;
  private city: string;

  constructor() {
    this.apiKey = config.weather.apiKey;
    this.city = config.weather.city;
  }

  async getMorningForecast(): Promise<WeatherForecast | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        this.city
      )}&appid=${this.apiKey}&units=metric&lang=pt_br`;

      const res = await axios.get(url, { timeout: 8000 });
      const data = res.data;

      const temp = Math.round(data.main.temp);
      const tempMin = Math.round(data.main.temp_min);
      const tempMax = Math.round(data.main.temp_max);
      const description = data.weather[0]?.description || 'Céu aberto';
      const humidity = data.main.humidity;
      const isRaining = /chuva|chuvisco|tempestade|garoa/i.test(description);

      // Sugestão de roupa e hidratação personalizada para corrida
      let suggestion = '';
      if (temp < 16) {
        suggestion = '🥶 Clima fresco: use segunda pele ou manga longa leve e faça bom aquecimento articular.';
      } else if (temp >= 16 && temp <= 23) {
        suggestion = '☀️ Clima perfeito para rodagem na rua! Regata/camiseta leve e bermuda de corrida.';
      } else {
        suggestion = '🔥 Calor: priorize correr cedo, boné/viseira e leve hidratação extra com eletrólitos!';
      }

      if (isRaining) {
        suggestion += ' 🌧️ Pista molhada: atenção às curvas ou opte pela esteira para maior segurança!';
      } else {
        suggestion += ' 💧 Hidratação: beba 300-500ml antes de sair.';
      }

      return {
        temp,
        tempMin,
        tempMax,
        description,
        humidity,
        rainProb: isRaining ? 80 : 10,
        suggestion,
      };
    } catch (err: any) {
      console.error('[WeatherService] Não foi possível obter previsão do tempo:', err.message);
      return null;
    }
  }
}

export const weatherService = new WeatherService();
