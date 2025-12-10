import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import cliProgress from "cli-progress";
import type {
  PropertyEvaluationCSV,
  PropertyEvaluationInsert,
} from "../src/types/property-evaluation";

// Configuration
const CSV_PATH = "./data/property-evaluations-clean.csv";
const BATCH_SIZE = 1000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Supabase credentials not found in environment");
  console.error("Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set");
  process.exit(1);
}

// Row transformer: CSV string values → typed database insert
function transformRow(csvRow: PropertyEvaluationCSV): PropertyEvaluationInsert {
  const parseIntOrNull = (value: string): number | null => {
    if (!value || value === "") return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  };

  return {
    id_uev: parseInt(csvRow.ID_UEV),
    matricule83: csvRow.MATRICULE83,
    civique_debut: parseIntOrNull(csvRow.CIVIQUE_DEBUT),
    civique_fin: parseIntOrNull(csvRow.CIVIQUE_FIN),
    lettre_debut: csvRow.LETTRE_DEBUT || null,
    lettre_fin: csvRow.LETTRE_FIN || null,
    nom_rue: csvRow.NOM_RUE.trim(),
    suite_debut: csvRow.SUITE_DEBUT || null,
    municipalite: csvRow.MUNICIPALITE || null,
    no_arrond_ile_cum: csvRow.NO_ARROND_ILE_CUM || null,
    etage_hors_sol: parseIntOrNull(csvRow.ETAGE_HORS_SOL),
    nombre_logement: parseIntOrNull(csvRow.NOMBRE_LOGEMENT),
    annee_construction: parseIntOrNull(csvRow.ANNEE_CONSTRUCTION),
    code_utilisation: parseIntOrNull(csvRow.CODE_UTILISATION),
    libelle_utilisation: csvRow.LIBELLE_UTILISATION.trim(),
    categorie_uef: csvRow.CATEGORIE_UEF.trim(),
    superficie_terrain: parseIntOrNull(csvRow.SUPERFICIE_TERRAIN),
    superficie_batiment: parseIntOrNull(csvRow.SUPERFICIE_BATIMENT),
  };
}

// Batch insert with retry logic
async function insertBatch(
  supabase: ReturnType<typeof createClient>,
  batch: PropertyEvaluationInsert[],
  retries = 3
): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { error } = await supabase
      .from("property_evaluations")
      .insert(batch);

    if (!error) return;

    if (attempt === retries - 1) {
      throw new Error(`Failed to insert batch after ${retries} attempts: ${error.message}`);
    }

    // Wait before retry (exponential backoff)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * Math.pow(2, attempt))
    );
  }
}

// Main import function with streaming + batching
async function importEvaluations() {
  console.log("📥 Starting import of property evaluations...\n");
  console.log(`Source: ${CSV_PATH}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Target: ${SUPABASE_URL}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let batch: PropertyEvaluationInsert[] = [];
  let processed = 0;
  let errors = 0;
  let batchCount = 0;

  const progressBar = new cliProgress.SingleBar(
    {
      format: "Progress |{bar}| {percentage}% | {value}/{total} records | Batch: {batch} | Errors: {errors}",
    },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(512000, 0, { batch: 0, errors: 0 }); // Approximate total

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM
    })
  );

  try {
    for await (const record of parser) {
      try {
        const transformed = transformRow(record as PropertyEvaluationCSV);
        batch.push(transformed);

        if (batch.length >= BATCH_SIZE) {
          await insertBatch(supabase, batch);
          processed += batch.length;
          batchCount++;
          progressBar.update(processed, { batch: batchCount, errors });
          batch = [];
        }
      } catch (error) {
        errors++;
        console.error(
          `\n❌ Error on row ${processed + batch.length + 1}:`,
          error
        );
      }
    }

    // Insert remaining records
    if (batch.length > 0) {
      await insertBatch(supabase, batch);
      processed += batch.length;
      batchCount++;
      progressBar.update(processed, { batch: batchCount, errors });
    }

    progressBar.stop();

    console.log("\n\n✅ Import complete!\n");
    console.log(`📊 Statistics:`);
    console.log(`   Total records processed: ${processed.toLocaleString()}`);
    console.log(`   Batches inserted: ${batchCount.toLocaleString()}`);
    console.log(`   Errors: ${errors.toLocaleString()}`);
    console.log(
      `   Success rate: ${((processed / (processed + errors)) * 100).toFixed(2)}%`
    );
  } catch (error) {
    progressBar.stop();
    console.error("\n❌ Fatal error during import:", error);
    process.exit(1);
  }
}

importEvaluations().catch(console.error);
