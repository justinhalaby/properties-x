import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import { createReadStream, writeFileSync } from "fs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CSV_PATH = "./data/property-evaluations-clean.csv";

async function findMissing() {
  console.log("🔍 Finding missing records...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get all IDs from database (in batches)
  console.log("Fetching IDs from database...");
  const dbIds = new Set<number>();
  let from = 0;
  const batchSize = 10000;

  while (true) {
    const { data, error } = await supabase
      .from("property_evaluations")
      .select("id_uev")
      .range(from, from + batchSize - 1);

    if (error) {
      console.error("Error:", error);
      break;
    }

    if (!data || data.length === 0) break;

    data.forEach((row) => dbIds.add(row.id_uev));
    from += batchSize;
    console.log(`  Fetched ${dbIds.size} IDs...`);
  }

  console.log(`\n✓ Total IDs in database: ${dbIds.size.toLocaleString()}`);

  // Read CSV and find missing IDs
  console.log("\nChecking CSV for missing IDs...");
  const csvIds: number[] = [];
  const missing: number[] = [];

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    })
  );

  for await (const record of parser) {
    const id = parseInt(record.ID_UEV);
    csvIds.push(id);
    if (!dbIds.has(id)) {
      missing.push(id);
    }
  }

  console.log(`\n✓ Total IDs in CSV: ${csvIds.length.toLocaleString()}`);
  console.log(`❌ Missing IDs: ${missing.length.toLocaleString()}\n`);

  if (missing.length > 0) {
    const report = `Missing IDs Report
==================
Total CSV records: ${csvIds.length}
Total DB records: ${dbIds.size}
Missing: ${missing.length}

First 100 missing ID_UEVs:
${missing.slice(0, 100).join("\n")}
${missing.length > 100 ? `\n... and ${missing.length - 100} more` : ""}
`;

    writeFileSync("./data/missing-ids-report.txt", report);
    console.log("📝 Report saved to: ./data/missing-ids-report.txt");
    console.log(`\nFirst 10 missing IDs: ${missing.slice(0, 10).join(", ")}`);
  }
}

findMissing().catch(console.error);
