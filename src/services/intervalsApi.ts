import axios from 'axios';

export interface IntervalsActivityResponse {
  id: string;
  start_date_local: string;
  name: string;
  type: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number; // m/s
  icu_rpe?: number;
  icu_training_load?: number;
  [key: string]: any;
}

export class IntervalsApiService {
  private baseUrl = 'https://intervals.icu/api/v1';

  /**
   * Busca atividades do atleta dentro do intervalo de datas
   * Base URL: https://intervals.icu/api/v1/athlete/{athlete_id}/activities
   * Autenticação: Basic Auth ("API_KEY", intervals_api_key)
   */
  async getActivities(
    athleteId: string,
    apiKey: string,
    oldestDate: string,
    newestDate: string
  ): Promise<IntervalsActivityResponse[]> {
    if (!athleteId || !apiKey) {
      return [];
    }

    const url = `${this.baseUrl}/athlete/${athleteId}/activities`;
    const token = Buffer.from(`API_KEY:${apiKey}`).toString('base64');

    try {
      const response = await axios.get<IntervalsActivityResponse[]>(url, {
        params: {
          oldest: oldestDate,
          newest: newestDate,
        },
        headers: {
          Authorization: `Basic ${token}`,
          Accept: 'application/json',
        },
        timeout: 20000,
      });

      return response.data || [];
    } catch (error: any) {
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`[IntervalsApi] Erro ao consultar atividades do atleta ${athleteId}: ${errorMsg}`);
      return [];
    }
  }
}

export const intervalsApi = new IntervalsApiService();
