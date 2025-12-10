import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Supabase credentials not found");
  console.error("Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set");
  process.exit(1);
}

async function applyMigration() {
  console.log("📦 Applying migration: 003_create_property_evaluations.sql\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Read migration file
  const migrationPath = join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "003_create_property_evaluations.sql"
  );

  const sql = readFileSync(migrationPath, "utf-8");

  console.log("⚠️  Warning: This requires a service role key (not anon key)");
  console.log("Please apply the migration manually via Supabase Dashboard:\n");
  console.log("1. Go to your Supabase project dashboard");
  console.log("2. Navigate to SQL Editor");
  console.log("3. Copy and paste the migration file contents");
  console.log("4. Click 'Run'\n");
  console.log("Migration file location:");
  console.log(`   ${migrationPath}\n`);

  // Show first few lines of the migration
  const lines = sql.split("\n").slice(0, 10);
  console.log("First 10 lines of migration:");
  console.log("─".repeat(60));
  lines.forEach(line => console.log(line));
  console.log("─".repeat(60));
  console.log("...\n");
}

applyMigration().catch(console.error);
