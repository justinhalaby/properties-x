/**
 * Quebec Company Registry DOM Extractor
 *
 * Pure DOM extraction functions that work in both Playwright (via page.evaluate)
 * and browser contexts (bookmarklet). No Playwright dependencies.
 */

import type {
  ScrapedShareholderData,
  ScrapedAdministratorData,
} from "@/types/company-registry";

/**
 * Helper: Find element by text content (case-insensitive)
 */
function findElementByText(root: Document | Element, regex: RegExp): Element | null {
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) return null;

  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );

  const matchedElements = new Set<Element>();

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const text = textNode.textContent?.trim() || '';

    if (regex.test(text)) {
      const parent = textNode.parentElement;
      if (parent && !matchedElements.has(parent)) {
        matchedElements.add(parent);
      }
    }
  }

  // Return first match
  return matchedElements.size > 0 ? Array.from(matchedElements)[0] : null;
}

/**
 * Helper: Get text of following sibling element
 */
function getFollowingSiblingText(element: Element | null): string {
  if (!element) return '';
  const sibling = element.nextElementSibling;
  return sibling?.textContent?.trim() || '';
}

/**
 * Helper: Get text value for a field by label
 */
function getFieldValue(root: Document | Element, labelPattern: string): string {
  const regex = new RegExp(`^${labelPattern}`, 'i');
  const labelElement = findElementByText(root, regex);
  return getFollowingSiblingText(labelElement);
}

/**
 * Extract NEQ (Numéro d'entreprise du Québec)
 */
export function extractNEQ(doc: Document): string {
  // Try to find NEQ by label
  const neqText = getFieldValue(doc, "Numéro\\s+d'entreprise\\s+du\\s+Québec");

  if (neqText && neqText.trim()) {
    return neqText.trim();
  }

  // Fallback: search for 10-digit number in page content
  const bodyText = doc.body?.textContent || '';
  const neqMatch = bodyText.match(/\b(\d{10})\b/);
  if (neqMatch) {
    return neqMatch[1];
  }

  return '';
}

/**
 * Extract company identification information
 */
export function extractIdentification(doc: Document): {
  name: string;
  status: string;
  domicile_address: string;
  registration_date: string;
  status_date?: string;
} {
  return {
    name: getFieldValue(doc, 'Nom'),
    status: getFieldValue(doc, 'Statut'),
    domicile_address: getFieldValue(doc, 'Adresse'),
    registration_date: getFieldValue(doc, "Date d'immatriculation"),
    status_date: getFieldValue(doc, "Date de mise à jour du statut") || undefined,
  };
}

/**
 * Extract shareholders (Actionnaires)
 */
export function extractShareholders(doc: Document): ScrapedShareholderData[] {
  const shareholders: ScrapedShareholderData[] = [];

  // Find the shareholders section heading
  const shareholdersHeading = findElementByText(doc, /^Actionnaires$/i);
  if (!shareholdersHeading) {
    return [];
  }

  // Position labels in order
  const positions = [
    'Premier actionnaire',
    'Deuxième actionnaire',
    'Troisième actionnaire',
    'Quatrième actionnaire',
    'Cinquième actionnaire',
  ];

  for (let i = 0; i < positions.length; i++) {
    const positionLabel = positions[i];
    const positionElement = findElementByText(doc, new RegExp(`^${positionLabel}`, 'i'));

    if (!positionElement) {
      break; // No more shareholders
    }

    // Get the container for this shareholder
    const container = positionElement.closest('div') || positionElement.parentElement;
    if (!container) continue;

    const name = getFieldValue(container, 'Nom');
    const address = getFieldValue(container, 'Adresse du domicile');
    const containerText = container.textContent || '';
    const isMajority = containerText.includes('majoritaire');

    if (name) {
      shareholders.push({
        name,
        address: address || '',
        is_majority: isMajority,
        position: i + 1,
      });
    }
  }

  return shareholders;
}

/**
 * Extract administrators
 */
export function extractAdministrators(doc: Document): ScrapedAdministratorData[] {
  const administrators: ScrapedAdministratorData[] = [];

  // Find the administrators section
  const adminHeading = findElementByText(doc, /^Administrateurs$/i);
  if (!adminHeading) {
    return [];
  }

  // Find all administrator entries by looking for "Nom de famille" labels
  const allElements = Array.from(doc.querySelectorAll('*'));
  const nameLabels = allElements.filter(el =>
    /^Nom de famille$/i.test(el.textContent?.trim() || '')
  );

  for (let i = 0; i < nameLabels.length; i++) {
    const nameLabel = nameLabels[i];

    // Get the container (usually 2 levels up)
    const container = nameLabel.closest('div')?.parentElement || nameLabel.parentElement;
    if (!container) continue;

    const lastName = getFieldValue(container, 'Nom de famille');
    const firstName = getFieldValue(container, 'Prénom');
    const position = getFieldValue(container, 'Fonctions actuelles');
    const domicileAddress = getFieldValue(container, 'Adresse du domicile');
    const professionalAddress = getFieldValue(container, 'Adresse professionnelle');

    if (lastName) {
      const fullName = `${firstName} ${lastName}`.trim();

      // Clean up addresses - if "non publiable", store as empty string
      const cleanDomicile = domicileAddress && domicileAddress.toLowerCase().includes('non publiable')
        ? ''
        : (domicileAddress || '');
      const cleanProfessional = professionalAddress && professionalAddress.toLowerCase().includes('non publiable')
        ? ''
        : (professionalAddress || '');

      administrators.push({
        name: fullName,
        position_title: position || '',
        domicile_address: cleanDomicile,
        professional_address: cleanProfessional,
        position_order: i + 1,
      });
    }
  }

  return administrators;
}

/**
 * Extract economic activity information
 */
export function extractEconomicActivity(doc: Document): {
  cae_code: string;
  cae_description: string;
} {
  const caeCode = getFieldValue(doc, "Code d'activité économique");
  const caeDescription = getFieldValue(doc, 'Activité');

  return {
    cae_code: caeCode || '',
    cae_description: caeDescription || '',
  };
}

/**
 * Extract all company data from the current document
 * This is the main function that bookmarklets will call
 */
export function extractCompanyData(doc: Document): {
  neq: string;
  identification: ReturnType<typeof extractIdentification>;
  shareholders: ScrapedShareholderData[];
  administrators: ScrapedAdministratorData[];
  economic_activity: ReturnType<typeof extractEconomicActivity>;
  source_url: string;
} {
  return {
    neq: extractNEQ(doc),
    identification: extractIdentification(doc),
    shareholders: extractShareholders(doc),
    administrators: extractAdministrators(doc),
    economic_activity: extractEconomicActivity(doc),
    source_url: typeof window !== 'undefined' ? window.location.href : '',
  };
}
