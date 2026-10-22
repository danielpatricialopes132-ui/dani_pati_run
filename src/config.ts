import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  databasePath: string;
  evolution: {
    baseUrl: string;
    instanceName: string;
    apiKey: string;
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

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || 'workouts.db',
  evolution: {
    baseUrl: formatBaseUrl(process.env.EVOLUTION_BASE_URL || process.env.EVOLUTION_API_URL),
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'ecostone',
    apiKey: process.env.EVOLUTION_API_KEY || '',
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
