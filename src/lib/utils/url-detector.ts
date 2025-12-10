import type { SourceName } from "@/types/property";

interface SourcePattern {
  name: SourceName;
  patterns: RegExp[];
}

const SOURCE_PATTERNS: SourcePattern[] = [
  {
    name: "centris",
    patterns: [
      /centris\.ca/i,
      /centris\.com/i,
    ],
  },
  {
    name: "realtor",
    patterns: [
      /realtor\.ca/i,
    ],
  },
  {
    name: "duproprio",
    patterns: [
      /duproprio\.com/i,
      /duproprio\.ca/i,
    ],
  },
  {
    name: "remax",
    patterns: [
      /remax\.ca/i,
      /remax\.com/i,
      /remax-quebec\.com/i,
    ],
  },
  {
    name: "royallepage",
    patterns: [
      /royallepage\.ca/i,
      /royallepage\.com/i,
    ],
  },
];

export function detectSource(url: string): SourceName {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (const source of SOURCE_PATTERNS) {
      for (const pattern of source.patterns) {
        if (pattern.test(hostname)) {
          return source.name;
        }
      }
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
