import path from "path";
import * as XLSX from "xlsx";
import { initDatabase, getDatabasePool } from "../database";

interface WorkoutRecord {
  id: string;
  athlete_id: string;
  date: string;
  focus: string;
  target_km: number;
  road_prescription: string;
  treadmill_prescription: string;
  strength_work: string;
  bike_work: string;
  clinical_notes: string;
  whatsapp_sent: number;
}

function formatarDataIso(dataInput: any): string | null {
  if (!dataInput) return null;
  if (dataInput instanceof Date) {
    return dataInput.toISOString().split("T")[0];
  }
  if (typeof dataInput === "number") {
    // Conversão de serial date do Excel
    const dataJs = new Date(Math.round((dataInput - 25569) * 86400 * 1000));
    return dataJs.toISOString().split("T")[0];
  }
  const str = String(dataInput).trim();
  const matchIso = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (matchIso) return matchIso[1];

  const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;

  return null;
}

export async function importarTreinosPatricia() {
  await initDatabase();
  const pool = getDatabasePool();

  const filePath = path.resolve(process.cwd(), "Planilha de Treinos - Patrícia Grübel (Meia Maratona Vênus 21K).xlsx");
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const registros: WorkoutRecord[] = [];

  // ==========================================
  // 1. Ciclo 1 - Cronograma Dia a Dia (Vênus)
  // ==========================================
  const sheetC1 = workbook.Sheets["Cronograma Dia a Dia"];
  if (sheetC1) {
    const rows: any[][] = XLSX.utils.sheet_to_json(sheetC1, { header: 1 });
    // Começa na linha de dados (índice 2)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const dataIso = formatarDataIso(row[0]);
      if (!dataIso) continue;

      const tipoTreino = String(row[3] || "Treino").trim();
      const aquecimento = row[4] ? String(row[4]).trim() : "";
      const principal = row[5] ? String(row[5]).trim() : "";
      const arrefecimento = row[6] ? String(row[6]).trim() : "";
      const km = parseFloat(String(row[7] || "0").replace(",", ".")) || 0;
      const nutricao = row[8] ? String(row[8]).trim() : "";
      const obs = row[9] ? String(row[9]).trim() : "";

      const prescricaoRua = [aquecimento && `AQ: ${aquecimento}`, principal, arrefecimento && `DQ: ${arrefecimento}`]
        .filter(Boolean)
        .join(" | ");

      const eFortalecimento = /fortalecimento|core|força|musculação/i.test(tipoTreino);

      registros.push({
        id: `patricia_${dataIso}`,
        athlete_id: "patricia",
        date: dataIso,
        focus: tipoTreino,
        target_km: km,
        road_prescription: !eFortalecimento && km > 0 ? prescricaoRua : (tipoTreino === "Descanso Total (OFF)" ? "OFF" : "—"),
        treadmill_prescription: !eFortalecimento && km > 0 ? "Opcional em esteira mantendo a mesma zona/tempo" : "—",
        strength_work: eFortalecimento ? principal || tipoTreino : "—",
        bike_work: /bike|giro/i.test(tipoTreino + principal) ? principal : "—",
        clinical_notes: [nutricao !== "-" && nutricao, obs !== "-" && obs].filter(Boolean).join(" | ") || "Hidratação regular",
        whatsapp_sent: 0,
      });
    }
  }

  // ==========================================
  // 2. Ciclo 2 - Olga Kos 9K (Semana de Transição)
  // ==========================================
  const treinosCiclo2: { date: string; focus: string; km: number; rua: string; clinica: string }[] = [
    { date: "2026-11-30", focus: "OFF", km: 0, rua: "Descanso pós-Vênus", clinica: "Recuperação ativa" },
    { date: "2026-12-01", focus: "Regenerativo", km: 3, rua: "Trote regenerativo leve pós-Vênus", clinica: "Soltura muscular" },
    { date: "2026-12-02", focus: "OFF / Mobilidade", km: 0, rua: "—", clinica: "Hidratação normal" },
    { date: "2026-12-03", focus: "Rodagem Solta", km: 4, rua: "Rodagem solta e confortável", clinica: "Sensação livre" },
    { date: "2026-12-04", focus: "OFF", km: 0, rua: "Descanso", clinica: "Descanso" },
    { date: "2026-12-05", focus: "Ativação / OFF", km: 0, rua: "Descanso pré-prova", clinica: "Descanso e boa alimentação" },
    { date: "2026-12-06", focus: "PROVA OLGA KOS 9K", km: 9, rua: "9 km Prova Oficial Olga Kos", clinica: "Hidratação nos postos. Festiva e confortável" },
  ];

  for (const t of treinosCiclo2) {
    registros.push({
      id: `patricia_${t.date}`,
      athlete_id: "patricia",
      date: t.date,
      focus: t.focus,
      target_km: t.km,
      road_prescription: t.rua,
      treadmill_prescription: t.km > 0 ? "Rua preferencial (semana de prova)" : "—",
      strength_work: "—",
      bike_work: "—",
      clinical_notes: t.clinica,
      whatsapp_sent: 0,
    });
  }

  // ==========================================
  // 3. Ciclo 3 - Maratona SP (5K + 21K)
  // ==========================================
  const sheetC3 = workbook.Sheets["Ciclo 3 - Maratona SP (5K + 21K"];
  if (sheetC3) {
    const rowsC3: any[] = XLSX.utils.sheet_to_json(sheetC3);
    for (const row of rowsC3) {
      const dataIso = formatarDataIso(row["Data"]);
      if (!dataIso) continue;

      const tipo = String(row["Tipo de Treino / Atividade"] || "Treino").trim();
      const prescricao = String(row["Prescrição da Sessão"] || "").trim();
      const km = parseFloat(String(row["Distância Prevista (km)"] || "0").replace(",", ".")) || 0;
      const nutricao = row["Estratégia de Hidratação & Nutrição"] || "";
      const obs = row["Observações Fisiológicas / Cuidados Musculares"] || "";
      const eForca = /fortalecimento|core|força/i.test(tipo);

      registros.push({
        id: `patricia_${dataIso}`,
        athlete_id: "patricia",
        date: dataIso,
        focus: tipo,
        target_km: km,
        road_prescription: !eForca && km > 0 ? prescricao : (tipo === "OFF" ? "Descanso Total" : "—"),
        treadmill_prescription: !eForca && km > 0 ? "Opção equivalente em esteira" : "—",
        strength_work: eForca ? prescricao : "—",
        bike_work: /bike/i.test(tipo + prescricao) ? prescricao : "—",
        clinical_notes: [nutricao, obs].filter(Boolean).join(" | "),
        whatsapp_sent: 0,
      });
    }
  }

  // ==========================================
  // 4. Ciclo 4 - Nike SP City 21K
  // ==========================================
  const sheetC4 = workbook.Sheets["Ciclo 4 - Nike SP City 21K"];
  if (sheetC4) {
    const rowsC4: any[] = XLSX.utils.sheet_to_json(sheetC4);
    for (const row of rowsC4) {
      const dataIso = formatarDataIso(row["Data"]);
      if (!dataIso) continue;

      const tipo = String(row["Tipo de Treino / Atividade"] || "Treino").trim();
      const prescricao = String(row["Prescrição da Sessão"] || "").trim();
      const km = parseFloat(String(row["Distância Prevista (km)"] || "0").replace(",", ".")) || 0;
      const nutricao = row["Estratégia de Hidratação & Nutrição"] || "";
      const obs = row["Observações Fisiológicas / Cuidados Musculares"] || "";
      const eForca = /fortalecimento|core|força/i.test(tipo);

      registros.push({
        id: `patricia_${dataIso}`,
        athlete_id: "patricia",
        date: dataIso,
        focus: tipo,
        target_km: km,
        road_prescription: !eForca && km > 0 ? prescricao : (tipo === "OFF" ? "Descanso Total" : "—"),
        treadmill_prescription: !eForca && km > 0 ? "Opção equivalente em esteira" : "—",
        strength_work: eForca ? prescricao : "—",
        bike_work: /bike/i.test(tipo + prescricao) ? prescricao : "—",
        clinical_notes: [nutricao, obs].filter(Boolean).join(" | "),
        whatsapp_sent: 0,
      });
    }
  }

  console.log(`\n📊 Registros lidos para a Patrícia: ${registros.length}`);
  console.log(`📤 Carregando para o Supabase (scheduled_workouts)...`);

  let inseridos = 0;
  for (const t of registros) {
    try {
      await pool.query(
        `
        INSERT INTO scheduled_workouts (
          id, athlete_id, date, focus, target_km, road_prescription, 
          treadmill_prescription, strength_work, bike_work, clinical_notes, whatsapp_sent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT(id) DO UPDATE SET
          focus = EXCLUDED.focus,
          target_km = EXCLUDED.target_km,
          road_prescription = EXCLUDED.road_prescription,
          treadmill_prescription = EXCLUDED.treadmill_prescription,
          strength_work = EXCLUDED.strength_work,
          bike_work = EXCLUDED.bike_work,
          clinical_notes = EXCLUDED.clinical_notes
      `,
        [
          t.id,
          t.athlete_id,
          t.date,
          t.focus,
          t.target_km,
          t.road_prescription,
          t.treadmill_prescription,
          t.strength_work,
          t.bike_work,
          t.clinical_notes,
          t.whatsapp_sent,
        ]
      );
      inseridos++;
    } catch (err: any) {
      console.error(`❌ Erro ao salvar treino ${t.id}:`, err.message);
    }
  }

  console.log(`✅ ${inseridos} treinos da Patrícia importados com sucesso para o Supabase!`);
}

if (require.main === module) {
  importarTreinosPatricia()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Erro na importação:", err);
      process.exit(1);
    });
}
