import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/migrate-owners
 *
 * Returns the migration SQL to run in Supabase SQL editor
 */
export async function GET() {
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), "supabase/migrations/014_create_owners_table.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    return new Response(migrationSQL, {
      headers: {
        "Content-Type": "text/plain",
      },
    });

  } catch (error) {
    console.error("Migration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to read migration",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
