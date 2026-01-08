(async function() {
  console.log('🚀 Starting Quebec company extraction test...');

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

  // Extract data
  const scrapedData = {
    neq: extractNEQ(document),
    identification: extractIdentification(document),
    shareholders: extractShareholders(document),
    administrators: extractAdministrators(document),
    beneficial_owners: extractBeneficialOwners(document),
    economic_activity: extractEconomicActivity(document),
    source_url: window.location.href,
  };

  console.log('📊 Extraction Results:');
  console.log('NEQ:', scrapedData.neq);
  console.log('Name:', scrapedData.identification.name);
  console.log('Status:', scrapedData.identification.status);
  console.log('Address:', scrapedData.identification.domicile_address);
  console.log('Shareholders:', scrapedData.shareholders.length);
  console.log('Administrators:', scrapedData.administrators.filter(a => !a.is_historical).length, 'current,', scrapedData.administrators.filter(a => a.is_historical).length, 'historical');
  console.log('Beneficial Owners:', scrapedData.beneficial_owners.length);
  console.log('CAE Code:', scrapedData.economic_activity.cae_code);
  console.log('\n📋 Full Data:', scrapedData);

  // Test API call
  console.log('\n🌐 Testing API call...');

  try {
    const response = await fetch('http://localhost:3000/api/companies/bookmarklet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bookmarklet-Key': 'qc_bookmarklet_2024_secure_key_abc123xyz789'
      },
      body: JSON.stringify(scrapedData)
    });

    const result = await response.json();
    console.log('✅ API Response:', result);

    if (result.success) {
      console.log('🎉 SUCCESS! Company saved with ID:', result.companyId);
      console.log('View at: http://localhost:3000/companies/' + result.companyId);
    } else {
      console.error('❌ API Error:', result.error || result.message);
    }
  } catch (error) {
    console.error('❌ Fetch Error:', error);
  }
})();
