import Database from 'better-sqlite3';
import path from 'path';
import { config } from './config';

let dbInstance: Database.Database | null = null;

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

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.isAbsolute(config.databasePath)
    ? config.databasePath
    : path.resolve(process.cwd(), config.databasePath);

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  initSchema(dbInstance);
  seedDefaultAthletes(dbInstance);

  return dbInstance;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS athletes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      intervals_athlete_id TEXT,
      intervals_api_key TEXT,
      notify_time TEXT DEFAULT '06:30',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      name TEXT NOT NULL,
      race_date TEXT NOT NULL,
      distance_km REAL,
      target_time TEXT,
      priority TEXT CHECK (priority IN ('P1', 'P2', 'P3')),
      FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_workouts (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      date TEXT NOT NULL,
      focus TEXT,
      target_km REAL,
      road_prescription TEXT,
      treadmill_prescription TEXT,
      strength_work TEXT,
      bike_work TEXT,
      clinical_notes TEXT,
      whatsapp_sent INTEGER DEFAULT 0,
      FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_activities (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT,
      type TEXT,
      distance_meters REAL,
      moving_time_seconds INTEGER,
      avg_hr REAL,
      avg_pace_sec_km REAL,
      rpe INTEGER,
      load REAL,
      FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_athlete_date ON scheduled_workouts(athlete_id, date);
    CREATE INDEX IF NOT EXISTS idx_completed_athlete_date ON completed_activities(athlete_id, date);
  `);
}

function seedDefaultAthletes(db: Database.Database): void {
  const insertStmt = db.prepare(`
    INSERT INTO athletes (id, name, whatsapp_number, intervals_athlete_id, intervals_api_key, notify_time, active)
    VALUES (@id, @name, @whatsapp_number, @intervals_athlete_id, @intervals_api_key, @notify_time, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      whatsapp_number = excluded.whatsapp_number,
      intervals_athlete_id = COALESCE(NULLIF(excluded.intervals_athlete_id, ''), athletes.intervals_athlete_id),
      intervals_api_key = COALESCE(NULLIF(excluded.intervals_api_key, ''), athletes.intervals_api_key)
  `);

  for (const a of config.initialAthletes) {
    if (a.id && a.whatsappNumber) {
      insertStmt.run({
        id: a.id,
        name: a.name,
        whatsapp_number: a.whatsappNumber,
        intervals_athlete_id: a.intervalsAthleteId || null,
        intervals_api_key: a.intervalsApiKey || null,
        notify_time: a.notifyTime || '06:30',
      });
    }
  }
}
