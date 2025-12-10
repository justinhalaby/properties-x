import { NextResponse } from "next/server";
import { getScraperForUrl } from "@/lib/scrapers";
import { isValidUrl } from "@/lib/utils/url-detector";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const scraper = getScraperForUrl(url);

    try {
      const property = await scraper.scrape(url);
      return NextResponse.json({ data: property });
    } catch (scrapeError) {
      console.error("Scrape error:", scrapeError);

      // Return a more helpful error for scraping failures
      const message =
        scrapeError instanceof Error
          ? scrapeError.message
          : "Failed to scrape property";

      return NextResponse.json(
        {
          error: message,
          suggestion: "Try entering the property details manually",
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Request error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
