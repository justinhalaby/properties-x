import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import { createReadStream, writeFileSync } from "fs";
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

// Error log
const errorLog: Array<{ row: number; id: number; error: string; data: any }> = [];

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

// Batch insert with detailed error logging
async function insertBatch(
  supabase: ReturnType<typeof createClient>,
  batch: PropertyEvaluationInsert[],
  batchNumber: number,
  retries = 3
): Promise<{ success: number; failed: number }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, error } = await supabase
      .from("property_evaluations")
      .insert(batch)
      .select("id_uev");

    if (!error) {
      return { success: batch.length, failed: 0 };
    }

    // Log the error
    console.log(`\n⚠️  Batch ${batchNumber} failed (attempt ${attempt + 1}/${retries}): ${error.message}`);

    if (attempt === retries - 1) {
      // Final attempt failed - try inserting one by one to identify problem rows
      console.log(`   Trying individual inserts for batch ${batchNumber}...`);
      let success = 0;
      let failed = 0;

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const { error: singleError } = await supabase
          .from("property_evaluations")
          .insert(row);

        if (singleError) {
          failed++;
          errorLog.push({
            row: (batchNumber - 1) * BATCH_SIZE + i + 1,
            id: row.id_uev,
            error: singleError.message,
            data: row,
          });
        } else {
          success++;
        }
      }

      return { success, failed };
    }

    // Wait before retry (exponential backoff)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 * Math.pow(2, attempt))
    );
  }

  return { success: 0, failed: batch.length };
}

// Main import function with streaming + batching
async function importEvaluations() {
  console.log("📥 Starting enhanced import of property evaluations...\n");
  console.log(`Source: ${CSV_PATH}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Target: ${SUPABASE_URL}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // First, clear existing data
  console.log("🗑️  Clearing existing data...");
  const { error: deleteError } = await supabase
    .from("property_evaluations")
    .delete()
    .neq("id_uev", 0); // Delete all records

  if (deleteError) {
    console.error("Error clearing table:", deleteError);
    console.log("Continuing with import anyway...\n");
  } else {
    console.log("✓ Table cleared\n");
  }

  let batch: PropertyEvaluationInsert[] = [];
  let processed = 0;
  let successCount = 0;
  let errorCount = 0;
  let batchCount = 0;

  const progressBar = new cliProgress.SingleBar(
    {
      format: "Progress |{bar}| {percentage}% | {value}/{total} | Success: {success} | Failed: {failed} | Batch: {batch}",
    },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(512000, 0, { success: 0, failed: 0, batch: 0 });

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    })
  );

  try {
    for await (const record of parser) {
      try {
        const transformed = transformRow(record as PropertyEvaluationCSV);
        batch.push(transformed);

        if (batch.length >= BATCH_SIZE) {
          batchCount++;
          const result = await insertBatch(supabase, batch, batchCount);
          successCount += result.success;
          errorCount += result.failed;
          processed += batch.length;
          progressBar.update(processed, {
            success: successCount,
            failed: errorCount,
            batch: batchCount
          });
          batch = [];
        }
      } catch (error) {
        errorCount++;
        errorLog.push({
          row: processed + batch.length + 1,
          id: parseInt(record.ID_UEV),
          error: error instanceof Error ? error.message : String(error),
          data: record,
        });
      }
    }

    // Insert remaining records
    if (batch.length > 0) {
      batchCount++;
      const result = await insertBatch(supabase, batch, batchCount);
      successCount += result.success;
      errorCount += result.failed;
      processed += batch.length;
      progressBar.update(processed, {
        success: successCount,
        failed: errorCount,
        batch: batchCount
      });
    }

    progressBar.stop();

    console.log("\n\n✅ Import complete!\n");
    console.log(`📊 Statistics:`);
    console.log(`   Total records processed: ${processed.toLocaleString()}`);
    console.log(`   Successfully inserted: ${successCount.toLocaleString()}`);
    console.log(`   Failed: ${errorCount.toLocaleString()}`);
    console.log(`   Batches processed: ${batchCount.toLocaleString()}`);
    console.log(`   Success rate: ${((successCount / processed) * 100).toFixed(2)}%`);

    if (errorLog.length > 0) {
      const errorReport = `
Import Error Report
==================
Generated: ${new Date().toISOString()}

Total Errors: ${errorLog.length}

Errors by Type:
${JSON.stringify(
  errorLog.reduce((acc, err) => {
    acc[err.error] = (acc[err.error] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  null,
  2
)}

First 50 Failed Records:
${errorLog.slice(0, 50).map(e =>
  `Row ${e.row} (ID: ${e.id}): ${e.error}`
).join('\n')}

${errorLog.length > 50 ? `\n... and ${errorLog.length - 50} more errors` : ''}
`;

      writeFileSync("./data/import-errors.txt", errorReport);
      console.log(`\n📝 Error report saved to: ./data/import-errors.txt`);
    }
  } catch (error) {
    progressBar.stop();
    console.error("\n❌ Fatal error during import:", error);
    process.exit(1);
  }
}

importEvaluations().catch(console.error);
