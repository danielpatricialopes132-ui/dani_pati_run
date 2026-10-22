import fs from "fs";
import path from "path";
// @ts-ignore
import pdf from "pdf-parse";
import { initDatabase, getDatabasePool } from "../database";

// Função utilitária para inferir o ano de acordo com a data/ciclo
function extrairDataIso(diaMesStr: string, anoPadrao: number): string | null {
  const match = diaMesStr.match(/(\d{2})\/(\d{2})/);
  if (!match) return null;
  const [, dia, mes] = match;

  let ano = anoPadrao;
  // Ajuste de virada de ano caso o ciclo atravesse dezembro/janeiro
  const mesNum = parseInt(mes, 10);
  if (anoPadrao === 2026 && (mesNum === 1 || mesNum === 2 || mesNum === 3 || mesNum === 4)) {
    ano = 2027;
  }

  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export async function importarPdf(pdfPath: string, athleteId: string) {
  await initDatabase();
  const pool = getDatabasePool();

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ Arquivo PDF não encontrado em: ${pdfPath}`);
    process.exit(1);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  console.log(`\n📄 Lendo PDF: ${pdfPath}`);
  console.log(`👤 Atleta alvo: ${athleteId.toUpperCase()}`);

  const parsed = await pdf(dataBuffer);
  const linhas: string[] = parsed.text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);

  let anoAtual = 2026;
  let treinosInseridos = 0;

  // Expressão regular para capturar linhas de treino (ex: "19/10 • SEG" ou "19/10 SEG")
  const diaRegex = /^(\d{2}\/\d{2})\s*[•-]?\s*(SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)\b/i;

  const batch: any[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    // Detecta ano no cabeçalho das semanas (ex: "07/12 a 13/12/2026" ou "25/01 a 31/01/2027")
    const anoMatch = linha.match(/202[6-7]/);
    if (anoMatch) {
      anoAtual = parseInt(anoMatch[0], 10);
    }

    const diaMatch = linha.match(diaRegex);
    if (diaMatch) {
      const dataStr = diaMatch[1];
      const dataIso = extrairDataIso(dataStr, anoAtual);

      if (!dataIso) continue;

      // Limpa os dados da linha removendo checkbox e campos vagos de anotação
      let conteudo = linha.replace(diaRegex, "").trim();
      conteudo = conteudo.replace(/□/g, "").replace(/_{2,}/g, "").trim();

      // Divide por separadores comuns ou múltiplos espaços gerados na extração tabular
      const partes = conteudo.split(/\s{2,}|\t/).filter((p: string) => p !== "—" && p !== "");

      // Mapeamento defensivo dos campos da tabela
      const foco = partes[0] || "Treino Programado";

      // Procura quilometragem (ex: "5,0", "6.5", "0", "8,0")
      let km = 0;
      const kmMatch = conteudo.match(/\b(\d+([,\.]\d+)?)\s*(km)?\b/);
      if (kmMatch && parseFloat(kmMatch[1].replace(",", ".")) <= 42) {
        km = parseFloat(kmMatch[1].replace(",", "."));
      }

      batch.push({
        id: `${athleteId}_${dataIso}`,
        athlete_id: athleteId,
        date: dataIso,
        focus: foco,
        target_km: km,
        road_prescription: partes[1] || "Conforme planilha",
        treadmill_prescription: partes[2] || "Conforme planilha",
        strength_work: partes.find((p: string) => /superior|inferior|core|mobilidade|ficha/i.test(p)) || "—",
        bike_work: partes.find((p: string) => /bike|z1|giro/i.test(p)) || "—",
        clinical_notes: partes.find((p: string) => /joelho|gelo|dor|sono|recuperação|rigidez|hidrata/i.test(p)) || "Registrar sensação pós-treino",
      });
    }
  }

  // Inserção no banco de dados (Supabase PostgreSQL)
  for (const t of batch) {
    await pool.query(
      `
      INSERT INTO scheduled_workouts (
        id, athlete_id, date, focus, target_km, road_prescription, 
        treadmill_prescription, strength_work, bike_work, clinical_notes, whatsapp_sent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
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
      ]
    );
    treinosInseridos++;
  }

  console.log(`✅ Importação concluída com sucesso!`);
  console.log(`📊 Total de treinos inseridos/atualizados para ${athleteId}: ${treinosInseridos}`);
}

// Execução direta via CLI: ts-node src/scripts/importPdfWorkouts.ts --athlete daniel
if (require.main === module) {
  const args = process.argv.slice(2);
  const athleteArgIndex = args.indexOf("--athlete");
  const athleteId = athleteArgIndex !== -1 && args[athleteArgIndex + 1] ? args[athleteArgIndex + 1] : "daniel";

  const pdfPath = path.resolve(process.cwd(), "Apresentação da Planilha de Treinos.pdf");
  importarPdf(pdfPath, athleteId)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Erro na importação:", err);
      process.exit(1);
    });
}
