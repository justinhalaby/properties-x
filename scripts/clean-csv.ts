import { createReadStream, createWriteStream, writeFileSync } from "fs";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import cliProgress from "cli-progress";
import type { PropertyEvaluationCSV } from "../src/types/property-evaluation";

// Configuration
const INPUT_CSV =
  process.env.CSV_PATH ||
  "/Users/justinhalaby/Downloads/uniteevaluationfonciere.csv";
const OUTPUT_CSV = "./data/property-evaluations-clean.csv";
const REPORT_FILE = "./data/cleaning-report.txt";

interface CleaningStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicates: number;
  errors: string[];
}

const stats: CleaningStats = {
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  duplicates: 0,
  errors: [],
};

const seenIds = new Set<string>();

// Validate and clean a single row
function validateRow(row: PropertyEvaluationCSV): boolean {
  // Check required fields
  if (!row.ID_UEV || !row.NOM_RUE || !row.LIBELLE_UTILISATION || !row.CATEGORIE_UEF || !row.MATRICULE83) {
    stats.errors.push(
      `Row ${stats.totalRows}: Missing required field(s)`
    );
    return false;
  }

  // Check for duplicates
  if (seenIds.has(row.ID_UEV)) {
    stats.duplicates++;
    stats.errors.push(`Row ${stats.totalRows}: Duplicate ID_UEV ${row.ID_UEV}`);
    return false;
  }

  // Validate ID_UEV is a number
  if (isNaN(parseInt(row.ID_UEV))) {
    stats.errors.push(
      `Row ${stats.totalRows}: Invalid ID_UEV "${row.ID_UEV}"`
    );
    return false;
  }

  seenIds.add(row.ID_UEV);
  return true;
}

// Clean and normalize row data
function cleanRow(row: PropertyEvaluationCSV): PropertyEvaluationCSV {
  return {
    ID_UEV: row.ID_UEV.trim(),
    CIVIQUE_DEBUT: row.CIVIQUE_DEBUT?.trim() || "",
    CIVIQUE_FIN: row.CIVIQUE_FIN?.trim() || "",
    NOM_RUE: row.NOM_RUE.trim(),
    SUITE_DEBUT: row.SUITE_DEBUT?.trim() || "",
    MUNICIPALITE: row.MUNICIPALITE?.trim() || "",
    ETAGE_HORS_SOL: row.ETAGE_HORS_SOL?.trim() || "",
    NOMBRE_LOGEMENT: row.NOMBRE_LOGEMENT?.trim() || "",
    ANNEE_CONSTRUCTION: row.ANNEE_CONSTRUCTION?.trim() || "",
    CODE_UTILISATION: row.CODE_UTILISATION?.trim() || "",
    LETTRE_DEBUT: row.LETTRE_DEBUT?.trim() || "",
    LETTRE_FIN: row.LETTRE_FIN?.trim() || "",
    LIBELLE_UTILISATION: row.LIBELLE_UTILISATION.trim(),
    CATEGORIE_UEF: row.CATEGORIE_UEF.trim(),
    MATRICULE83: row.MATRICULE83.trim(),
    SUPERFICIE_TERRAIN: row.SUPERFICIE_TERRAIN?.trim() || "",
    SUPERFICIE_BATIMENT: row.SUPERFICIE_BATIMENT?.trim() || "",
    NO_ARROND_ILE_CUM: row.NO_ARROND_ILE_CUM?.trim() || "",
  };
}

async function cleanCSV() {
  console.log("🧹 Starting CSV cleaning process...\n");
  console.log(`Input: ${INPUT_CSV}`);
  console.log(`Output: ${OUTPUT_CSV}`);
  console.log(`Report: ${REPORT_FILE}\n`);

  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(512287, 0);

  const parser = createReadStream(INPUT_CSV).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM for French characters
    })
  );

  const stringifier = stringify({
    header: true,
    columns: [
      "ID_UEV",
      "CIVIQUE_DEBUT",
      "CIVIQUE_FIN",
      "NOM_RUE",
      "SUITE_DEBUT",
      "MUNICIPALITE",
      "ETAGE_HORS_SOL",
      "NOMBRE_LOGEMENT",
      "ANNEE_CONSTRUCTION",
      "CODE_UTILISATION",
      "LETTRE_DEBUT",
      "LETTRE_FIN",
      "LIBELLE_UTILISATION",
      "CATEGORIE_UEF",
      "MATRICULE83",
      "SUPERFICIE_TERRAIN",
      "SUPERFICIE_BATIMENT",
      "NO_ARROND_ILE_CUM",
    ],
  });

  const output = createWriteStream(OUTPUT_CSV);
  stringifier.pipe(output);

  try {
    for await (const record of parser) {
      stats.totalRows++;

      if (validateRow(record as PropertyEvaluationCSV)) {
        const cleaned = cleanRow(record as PropertyEvaluationCSV);
        stringifier.write(cleaned);
        stats.validRows++;
      } else {
        stats.invalidRows++;
      }

      if (stats.totalRows % 10000 === 0) {
        progressBar.update(stats.totalRows);
      }
    }

    stringifier.end();
    progressBar.stop();

    // Wait for output stream to finish
    await new Promise((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    });

    // Generate report
    const report = `
CSV Cleaning Report
==================
Generated: ${new Date().toISOString()}

Input File: ${INPUT_CSV}
Output File: ${OUTPUT_CSV}

Statistics:
-----------
Total rows processed: ${stats.totalRows.toLocaleString()}
Valid rows: ${stats.validRows.toLocaleString()}
Invalid rows: ${stats.invalidRows.toLocaleString()}
Duplicate IDs: ${stats.duplicates.toLocaleString()}

Validation rate: ${((stats.validRows / stats.totalRows) * 100).toFixed(2)}%

Errors:
-------
${stats.errors.length > 0 ? stats.errors.slice(0, 100).join("\n") : "None"}
${stats.errors.length > 100 ? `\n... and ${stats.errors.length - 100} more errors` : ""}
`;

    writeFileSync(REPORT_FILE, report);

    console.log("\n✅ CSV cleaning complete!\n");
    console.log(`📊 Total rows processed: ${stats.totalRows.toLocaleString()}`);
    console.log(`✓ Valid rows: ${stats.validRows.toLocaleString()}`);
    console.log(`✗ Invalid rows: ${stats.invalidRows.toLocaleString()}`);
    console.log(`⚠ Duplicates: ${stats.duplicates.toLocaleString()}\n`);
    console.log(`📝 Report saved to: ${REPORT_FILE}`);
  } catch (error) {
    progressBar.stop();
    console.error("\n❌ Error during CSV cleaning:", error);
    process.exit(1);
  }
}

cleanCSV().catch(console.error);
