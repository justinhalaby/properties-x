import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Supabase credentials not found");
  process.exit(1);
}

async function checkImport() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("🔍 Checking import status...\n");

  // Get total count
  const { count, error } = await supabase
    .from("property_evaluations")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`📊 Total records in database: ${count?.toLocaleString()}`);
  console.log(`📄 Expected from CSV: 512,288`);
  console.log(`❌ Missing records: ${(512288 - (count || 0)).toLocaleString()}\n`);

  // Check for potential issues
  console.log("Checking for data issues...\n");

  // Sample some records
  const { data: sample } = await supabase
    .from("property_evaluations")
    .select("id_uev, clean_address, categorie_uef")
    .limit(5);

  console.log("Sample records:");
  console.table(sample);
}

checkImport().catch(console.error);
