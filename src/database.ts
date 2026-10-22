import { Pool } from 'pg';
import { config } from './config';

export interface AthleteRecord {
  id: string;
  name: string;
  whatsapp_number: string;
  intervals_athlete_id: string | null;
  intervals_api_key: string | null;
  notify_time: string;
  active: number;
  created_at: string;
}

export interface RaceRecord {
  id: string;
  athlete_id: string;
  name: string;
  race_date: string;
  distance_km: number | null;
  target_time: string | null;
  priority: 'P1' | 'P2' | 'P3';
}

export interface ScheduledWorkoutRecord {
  id: string;
  athlete_id: string;
  date: string;
  focus: string | null;
  target_km: number | null;
  road_prescription: string | null;
  treadmill_prescription: string | null;
  strength_work: string | null;
  bike_work: string | null;
  clinical_notes: string | null;
  whatsapp_sent: number;
}

export interface CompletedActivityRecord {
  id: string;
  athlete_id: string;
  date: string;
  name: string | null;
  type: string | null;
  distance_meters: number | null;
  moving_time_seconds: number | null;
  avg_hr: number | null;
  avg_pace_sec_km: number | null;
  rpe: number | null;
  load: number | null;
}

let poolInstance: Pool | null = null;

export function getDatabasePool(): Pool {
  if (poolInstance) {
    return poolInstance;
  }

  // Remove sslmode=require da query string se presente para evitar conflito com rejectUnauthorized
  const cleanUrl = config.databaseUrl.replace(/(\?|&)sslmode=[^&]+/g, '');

  poolInstance = new Pool({
    connectionString: cleanUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return poolInstance;
}

export async function initDatabase(): Promise<void> {
  const pool = getDatabasePool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS athletes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      intervals_athlete_id TEXT,
      intervals_api_key TEXT,
      notify_time TEXT DEFAULT '06:30',
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      race_date TEXT NOT NULL,
      distance_km NUMERIC,
      target_time TEXT,
      priority TEXT CHECK (priority IN ('P1', 'P2', 'P3'))
    );

    CREATE TABLE IF NOT EXISTS scheduled_workouts (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      focus TEXT,
      target_km NUMERIC,
      road_prescription TEXT,
      treadmill_prescription TEXT,
      strength_work TEXT,
      bike_work TEXT,
      clinical_notes TEXT,
      whatsapp_sent INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS completed_activities (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      name TEXT,
      type TEXT,
      distance_meters NUMERIC,
      moving_time_seconds INTEGER,
      avg_hr NUMERIC,
      avg_pace_sec_km NUMERIC,
      rpe INTEGER,
      load NUMERIC
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_athlete_date ON scheduled_workouts(athlete_id, date);
    CREATE INDEX IF NOT EXISTS idx_completed_athlete_date ON completed_activities(athlete_id, date);
  `);

  // Sementes iniciais dos atletas
  for (const a of config.initialAthletes) {
    if (a.id && a.whatsappNumber) {
      await pool.query(
        `
        INSERT INTO athletes (id, name, whatsapp_number, intervals_athlete_id, intervals_api_key, notify_time, active)
        VALUES ($1, $2, $3, $4, $5, $6, 1)
        ON CONFLICT(id) DO UPDATE SET
          name = EXCLUDED.name,
          whatsapp_number = EXCLUDED.whatsapp_number,
          intervals_athlete_id = COALESCE(NULLIF(EXCLUDED.intervals_athlete_id, ''), athletes.intervals_athlete_id),
          intervals_api_key = COALESCE(NULLIF(EXCLUDED.intervals_api_key, ''), athletes.intervals_api_key)
        `,
        [
          a.id,
          a.name,
          a.whatsappNumber,
          a.intervalsAthleteId || null,
          a.intervalsApiKey || null,
          a.notifyTime || '06:30',
        ]
      );
    }
  }

  // Sementes das provas-alvo da Patrícia e do Daniel
  const defaultRaces = [
    { id: 'race_patricia_venus_2026', athlete_id: 'patricia', name: 'Meia Maratona Vênus 21K', race_date: '2026-11-29', distance_km: 21.1, target_time: '02:05:00', priority: 'P1' },
    { id: 'race_patricia_olgakos_2026', athlete_id: 'patricia', name: 'Corrida Olga Kos 9K', race_date: '2026-12-06', distance_km: 9.0, target_time: '00:52:00', priority: 'P2' },
    { id: 'race_patricia_spcity_2027', athlete_id: 'patricia', name: 'SP City Half Marathon 21K', race_date: '2027-07-25', distance_km: 21.1, target_time: '01:59:00', priority: 'P1' },
    { id: 'race_daniel_spcity_2027', athlete_id: 'daniel', name: 'SP City Marathon 42K', race_date: '2027-07-25', distance_km: 42.2, target_time: '03:45:00', priority: 'P1' }
  ];

  for (const r of defaultRaces) {
    await pool.query(`
      INSERT INTO races (id, athlete_id, name, race_date, distance_km, target_time, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        race_date = EXCLUDED.race_date,
        distance_km = EXCLUDED.distance_km,
        target_time = EXCLUDED.target_time,
        priority = EXCLUDED.priority
    `, [r.id, r.athlete_id, r.name, r.race_date, r.distance_km, r.target_time, r.priority]);
  }
}
