(function () {
  'use strict';

  const API_ENDPOINT = 'API_ENDPOINT_PLACEHOLDER';
  const API_KEY = 'BOOKMARKLET_API_KEY_PLACEHOLDER';

  function getFieldValue(root, labelText) {
    const labels = root.querySelectorAll('.kx-display-label');
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const text = (label.textContent || '').trim();
      const regex = new RegExp('^' + labelText.replace(/[()]/g, '\\$&') + '$', 'i');

      if (regex.test(text)) {
        let sibling = label.nextElementSibling;
        while (sibling) {
          // Handle both correct format (.kx-display-field) and malformed format (span-display-field tag)
          if ((sibling.classList && sibling.classList.contains('kx-display-field')) ||
              sibling.tagName === 'SPAN-DISPLAY-FIELD') {
            return (sibling.textContent || '').trim();
          }
          sibling = sibling.nextElementSibling;
        }
      }
    }
    return '';
  }

  function extractNEQ(doc) {
    const neq = getFieldValue(doc, "Numéro d'entreprise du Québec (NEQ)");
    if (neq) return neq;

    const bodyText = doc.body.textContent || '';
    const neqMatch = bodyText.match(/\b(\d{10})\b/);
    return neqMatch ? neqMatch[1] : '';
  }

  function extractIdentification(doc) {
    return {
      name: getFieldValue(doc, 'Nom'),
      status: getFieldValue(doc, 'Statut'),
      domicile_address: getFieldValue(doc, 'Adresse'),
      registration_date: getFieldValue(doc, "Date d'immatriculation"),
      status_date: getFieldValue(doc, "Date de mise à jour du statut") || undefined,
    };
  }

  function extractShareholders(doc) {
    const shareholders = [];

    // Check if this is a corporation (Actionnaires) or partnership (Associés)
    const isCorporation = Array.from(doc.querySelectorAll('h4')).some(h =>
      h.textContent.trim() === 'Actionnaires'
    );
    const isPartnership = Array.from(doc.querySelectorAll('h4')).some(h =>
      h.textContent.trim() === 'Associés'
    );

    if (!isCorporation && !isPartnership) {
      return []; // No shareholders/partners section found
    }

    const allLists = doc.querySelectorAll('ul.kx-synthese');

    if (isCorporation) {
      // Handle corporations with numbered shareholders (Premier, Deuxième, etc.)
      const positions = [
        'Premier actionnaire',
        'Deuxième actionnaire',
        'Troisième actionnaire',
        'Quatrième actionnaire',
        'Cinquième actionnaire',
      ];

      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const firstLabel = list.querySelector('.kx-display-label');
        if (!firstLabel) continue;

        const text = firstLabel.textContent.trim();
        for (let j = 0; j < positions.length; j++) {
          if (text.includes(positions[j])) {
            let name = '';
            const lastName = getFieldValue(list, 'Nom de famille');
            const firstName = getFieldValue(list, 'Prénom');

            if (lastName || firstName) {
              name = (firstName + ' ' + lastName).trim();
            } else {
              name = getFieldValue(list, 'Nom');
            }

            const address = getFieldValue(list, 'Adresse du domicile');
            const isMajority = list.textContent.includes('majoritaire');

            if (name) {
              shareholders.push({
                name: name,
                address: address || '',
                is_majority: isMajority,
                position: j + 1,
              });
            }
            break;
          }
        }
      }
    } else if (isPartnership) {
      // Handle partnerships with partners (Associés) - they're not numbered
      let partnerCount = 0;
      let foundPartnerSection = false;

      for (let i = 0; i < allLists.length; i++) {
        const list = allLists[i];
        const labels = Array.from(list.querySelectorAll('.kx-display-label')).map(l => l.textContent.trim());

        // Check if this list has partner-specific fields (use includes for flexibility with apostrophes)
        const hasPartnerType = labels.some(l => l.includes("Type d") && l.includes("associ"));

        if (hasPartnerType) {
          foundPartnerSection = true;
          let name = '';
          const lastName = getFieldValue(list, 'Nom de famille');
          const firstName = getFieldValue(list, 'Prénom');

          if (lastName || firstName) {
            name = (firstName + ' ' + lastName).trim();
          } else {
            name = getFieldValue(list, 'Nom');
          }

          const address = getFieldValue(list, 'Adresse du domicile') ||
                          getFieldValue(list, 'Adresse professionnelle');
          const partnerType = getFieldValue(list, "Type d'associé");

          if (name) {
            partnerCount++;
            shareholders.push({
              name: name,
              address: address || '',
              is_majority: partnerType === 'Commandité', // General partners are like majority
              position: partnerCount,
            });
          }
        } else if (foundPartnerSection && !hasPartnerType) {
          // We've moved past the partners section
          break;
        }
      }
    }

    return shareholders;
  }

  function extractAdministrators(doc) {
    const administrators = [];
    let foundAdminSection = false;
    const allLists = doc.querySelectorAll('ul.kx-synthese');

    // Track whether we're in the historical section
    let inHistoricalSection = false;

    for (let i = 0; i < allLists.length; i++) {
      const list = allLists[i];

      // Check if this list is inside a historical accordion
      let parent = list.parentElement;
      while (parent && parent !== doc.body) {
        if (parent.classList && parent.classList.contains('accordion')) {
          // Check if the accordion has "Historique" heading
          const heading = parent.querySelector('.h b, .h strong');
          if (heading && heading.textContent.includes('Historique')) {
            inHistoricalSection = true;
          }
          break;
        }
        parent = parent.parentElement;
      }

      const labels = list.querySelectorAll('.kx-display-label');

      let hasNomDeFamille = false;
      let hasFonctions = false;

      for (let j = 0; j < labels.length; j++) {
        const labelText = labels[j].textContent.trim();
        if (labelText === 'Nom de famille') hasNomDeFamille = true;
        if (labelText === 'Fonctions actuelles') hasFonctions = true;
      }

      if (hasNomDeFamille && hasFonctions) {
        foundAdminSection = true;
        const lastName = getFieldValue(list, 'Nom de famille');
        const firstName = getFieldValue(list, 'Prénom');
        const position = getFieldValue(list, 'Fonctions actuelles');
        const domicileAddress = getFieldValue(list, 'Adresse du domicile');
        const dateStart = getFieldValue(list, 'Date du début de la charge');
        const dateEnd = getFieldValue(list, 'Date de la fin de la charge');

        if (lastName) {
          const fullName = (firstName + ' ' + lastName).trim();
          const cleanDomicile = domicileAddress && domicileAddress.toLowerCase().includes('non publiable')
            ? ''
            : domicileAddress || '';

          administrators.push({
            name: fullName,
            position_title: position || '',
            domicile_address: cleanDomicile,
            professional_address: '',
            position_order: administrators.length + 1,
            is_historical: inHistoricalSection,
            date_start: dateStart || '',
            date_end: dateEnd || '',
          });
        }
      }

      if (foundAdminSection && !hasNomDeFamille && !inHistoricalSection) {
        break;
      }

      // Reset historical flag for next iteration
      inHistoricalSection = false;
    }

    return administrators;
  }

  function extractBeneficialOwners(doc) {
    const beneficialOwners = [];
    let foundBeneficialOwnerSection = false;
    const allLists = doc.querySelectorAll('ul.kx-synthese');

    // Check if there's a beneficial owners section
    const hasBeneficialOwnersSection = Array.from(doc.querySelectorAll('h4')).some(h =>
      h.textContent.includes('bénéficiaires ultimes')
    );

    if (!hasBeneficialOwnersSection) {
      return []; // No beneficial owners section found
    }

    for (let i = 0; i < allLists.length; i++) {
      const list = allLists[i];
      const labels = Array.from(list.querySelectorAll('.kx-display-label')).map(l => l.textContent.trim());

      // Check if this list has beneficial owner-specific fields
      const hasBeneficialOwnerFields = labels.some(l =>
        l.includes('Date du début du statut') ||
        l.includes('Situations applicables')
      );

      if (hasBeneficialOwnerFields) {
        foundBeneficialOwnerSection = true;
        const lastName = getFieldValue(list, 'Nom de famille');
        const firstName = getFieldValue(list, 'Prénom');
        const otherNames = getFieldValue(list, 'Autres noms utilisés');
        const statusStartDate = getFieldValue(list, 'Date du début du statut');
        const applicableSituations = getFieldValue(list, 'Situations applicables au bénéficiaire ultime');
        const domicileAddress = getFieldValue(list, 'Adresse du domicile');

        if (lastName || firstName) {
          beneficialOwners.push({
            first_name: firstName || '',
            last_name: lastName || '',
            other_names: otherNames || '',
            status_start_date: statusStartDate || '',
            applicable_situations: applicableSituations || '',
            domicile_address: domicileAddress && domicileAddress.toLowerCase().includes('non publiable')
              ? ''
              : domicileAddress || '',
            position_order: beneficialOwners.length + 1,
          });
        }
      } else if (foundBeneficialOwnerSection && !hasBeneficialOwnerFields) {
        // We've moved past the beneficial owners section
        break;
      }
    }

    return beneficialOwners;
  }

  function extractEconomicActivity(doc) {
    const caeCode = getFieldValue(doc, "Code d'activité économique (CAE)");
    const caeDescription = getFieldValue(doc, 'Activité');

    return {
      cae_code: caeCode || '',
      cae_description: caeDescription || '',
    };
  }

  const OVERLAY_ID = 'quebec-company-bookmarklet-overlay';

  function createOverlay(message, type, companyId) {
    removeOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    overlay.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 400px;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      transition: opacity 0.3s ease;
      cursor: pointer;
    `;

    switch (type) {
      case 'loading':
        overlay.style.backgroundColor = '#1f2937';
        overlay.style.color = '#f3f4f6';
        overlay.style.border = '2px solid #374151';
        overlay.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 20px;
              height: 20px;
              border: 2px solid #f3f4f6;
              border-top-color: transparent;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            "></div>
            <span>${message}</span>
          </div>
          <style>
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        `;
        break;

      case 'success':
        overlay.style.backgroundColor = '#065f46';
        overlay.style.color = '#d1fae5';
        overlay.style.border = '2px solid #10b981';
        overlay.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="#d1fae5"/>
              </svg>
              <span style="font-weight: 600;">${message}</span>
            </div>
            ${
              companyId
                ? `
              <a
                href="${window.location.origin}/companies/${companyId}"
                target="_blank"
                style="
                  color: #a7f3d0;
                  text-decoration: underline;
                  font-size: 13px;
                  margin-left: 32px;
                "
              >
                View company →
              </a>
            `
                : ''
            }
          </div>
        `;
        setTimeout(removeOverlay, 5000);
        break;

      case 'error':
        overlay.style.backgroundColor = '#7f1d1d';
        overlay.style.color = '#fecaca';
        overlay.style.border = '2px solid #dc2626';
        overlay.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; margin-top: 2px;">
              <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="#fecaca"/>
            </svg>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 4px;">Error</div>
              <div style="font-size: 13px;">${message}</div>
              <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">Click to dismiss</div>
            </div>
          </div>
        `;
        break;
    }

    overlay.addEventListener('click', removeOverlay);

    document.body.appendChild(overlay);
    return overlay;
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  async function extractAndSave() {
    try {
      createOverlay('Extracting company data...', 'loading');

      const scrapedData = {
        neq: extractNEQ(document),
        identification: extractIdentification(document),
        shareholders: extractShareholders(document),
        administrators: extractAdministrators(document),
        beneficial_owners: extractBeneficialOwners(document),
        economic_activity: extractEconomicActivity(document),
        source_url: window.location.href,
      };

      console.log('Bookmarklet extraction results:', scrapedData);

      if (!scrapedData.neq) {
        createOverlay('Could not find NEQ on this page. Check console for details. Are you on a company details page?', 'error');
        console.error('NEQ not found. Page body text:', document.body.textContent.substring(0, 500));
        return;
      }

      if (!scrapedData.identification.name) {
        createOverlay(
          'Could not find company name on this page. Are you on a company details page?',
          'error'
        );
        return;
      }

      createOverlay('Saving company data...', 'loading');

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bookmarklet-Key': API_KEY,
        },
        body: JSON.stringify(scrapedData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const message = result.fromCache
          ? `Company already in database`
          : `Saved: ${scrapedData.identification.name}`;
        createOverlay(message, 'success', result.companyId);
      } else {
        createOverlay(result.error || result.message || 'Failed to save company data', 'error');
      }
    } catch (error) {
      console.error('Bookmarklet error:', error);
      createOverlay(
        `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        'error'
      );
    }
  }

  extractAndSave();
})();
