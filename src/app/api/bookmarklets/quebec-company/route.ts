import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    // Read the bookmarklet source file
    const bookmarkletPath = join(
      process.cwd(),
      'src/lib/bookmarklets/quebec-company-bookmarklet.ts'
    );

    let bookmarkletCode = await readFile(bookmarkletPath, 'utf-8');

    // Get environment variables
    const apiKey = process.env.BOOKMARKLET_API_KEY || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apiEndpoint = `${appUrl}/api/companies/bookmarklet`;

    if (!apiKey) {
      console.warn('Warning: BOOKMARKLET_API_KEY is not set in environment variables');
    }

    // Remove comments BEFORE injecting values (to avoid matching // in URLs)
    bookmarkletCode = bookmarkletCode
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\/\/.*/g, '') // Remove single-line comments
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    // Inject environment-specific values AFTER comment removal
    bookmarkletCode = bookmarkletCode
      .replace('API_ENDPOINT_PLACEHOLDER', apiEndpoint)
      .replace('BOOKMARKLET_API_KEY_PLACEHOLDER', apiKey);

    // Minify: compress to single line for bookmarklet compatibility
    bookmarkletCode = bookmarkletCode
      .replace(/\s+/g, ' ') // Replace all whitespace sequences with single space
      .replace(/\s*([{}();,:])\s*/g, '$1') // Remove spaces around punctuation
      .trim();

    // Return as JavaScript
    return new Response(bookmarkletCode, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving bookmarklet:', error);
    return NextResponse.json(
      { error: 'Failed to load bookmarklet code' },
      { status: 500 }
    );
  }
}
