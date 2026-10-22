import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  evolution: {
    baseUrl: string;
    instanceName: string;
    apiKey: string;
  };
  weather: {
    apiKey: string;
    city: string;
  };
  initialAthletes: {
    id: string;
    name: string;
    whatsappNumber: string;
    intervalsAthleteId?: string;
    intervalsApiKey?: string;
    notifyTime: string;
  }[];
}

const formatBaseUrl = (url?: string): string => {
  if (!url) return '';
  return url.replace(/[\[\]]/g, '').trim().replace(/\/+$/, '');
};

const defaultDbUrl =
  'postgresql://postgres.kstgsyvjmgglqpbdtdup:A3p3xKLMgsZXgMsj@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || defaultDbUrl,
  evolution: {
    baseUrl: formatBaseUrl(process.env.EVOLUTION_BASE_URL || process.env.EVOLUTION_API_URL),
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'ecostone',
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '4066ca63e2850558ed7b5e3377357a91',
    city: process.env.WEATHER_CITY || 'Sao Paulo,BR',
  },
  initialAthletes: [
    {
      id: 'daniel',
      name: 'Daniel',
      whatsappNumber: process.env.DANIEL_PHONE || '5511988139833',
      intervalsAthleteId: process.env.DANIEL_INTERVALS_ID || 'i753639',
      intervalsApiKey: process.env.DANIEL_INTERVALS_KEY || '2uarr3hetzp8m8qw70b2q2ekc',
      notifyTime: '06:30',
    },
    {
      id: 'patricia',
      name: 'Patrícia',
      whatsappNumber: process.env.PATRICIA_PHONE || '5511988136702',
      intervalsAthleteId: process.env.PATRICIA_INTERVALS_ID || '',
      intervalsApiKey: process.env.PATRICIA_INTERVALS_KEY || '',
      notifyTime: '06:30',
    },
  ],
};
