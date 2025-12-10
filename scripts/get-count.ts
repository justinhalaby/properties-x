import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getCount() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { count, error } = await supabase
    .from("property_evaluations")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`\nTotal records in database: ${count?.toLocaleString()}`);
}

getCount();
