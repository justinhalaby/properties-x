(() => {
  // Extract Centris ID from URL
  const url = window.location.href;
  const centrisIdMatch = url.match(/\/(\d+)(?:\?|$)/);
  const centrisId = centrisIdMatch ? centrisIdMatch[1] : null;

  if (!centrisId) {
    console.error('❌ Could not extract Centris ID from URL');
    return null;
  }

  const rawData = {
    // Basic info
    listing_id: document.querySelector('#ListingId')?.textContent?.trim() ||
                document.querySelector('[id="ListingDisplayId"]')?.textContent?.trim(),

    // Property type and address
    property_type: document.querySelector('[data-id="PageTitle"]')?.textContent?.trim(),
    address: document.querySelector('h2[itemprop="address"]')?.textContent?.trim(),

    // Price
    price: document.querySelector('meta[itemprop="price"]')?.content,
    price_currency: document.querySelector('meta[itemprop="priceCurrency"]')?.content,
    price_display: document.querySelector('.price .text-nowrap')?.textContent?.trim(),

    // Coordinates
    latitude: document.querySelector('meta[itemprop="latitude"]')?.content,
    longitude: document.querySelector('meta[itemprop="longitude"]')?.content,

    // Room info from teaser section
    rooms: document.querySelector('.teaser .piece')?.textContent?.trim(),
    bedrooms: document.querySelector('.teaser .cac')?.textContent?.trim(),
    bathrooms: document.querySelector('.teaser .sdb')?.textContent?.trim(),

    // Characteristics
    characteristics: {},

    // Description
    description: document.querySelector('[itemprop="description"]')?.textContent?.trim(),

    // Walk Score
    walk_score: document.querySelector('.walkscore span')?.textContent?.trim(),

    // Images
    images: [],
    images_high_res: [],

    // Brokers
    brokers: []
  };

  // Create the final data structure
  const data = {
    centris_id: centrisId,
    source_url: url.split('?')[0], // Remove query params
    extracted_at: new Date().toISOString(),
    raw_data: rawData
  };
  
  // Extract characteristics
  document.querySelectorAll('.carac-container').forEach(container => {
    const title = container.querySelector('.carac-title')?.textContent?.trim();
    const value = container.querySelector('.carac-value span')?.textContent?.trim();
    if (title && value) {
      rawData.characteristics[title] = value;
    }
  });

  // Extract all image URLs
  if (window.MosaicPhotoUrls) {
    rawData.images = window.MosaicPhotoUrls;
  } else {
    // Fallback: extract from photo buttons data attribute or img tags
    const photoData = document.querySelector('#property-roomvo-data');
    if (photoData) {
      const photoUrls = photoData.getAttribute('data-photo-urls');
      if (photoUrls) {
        rawData.images = photoUrls.split(',');
      }
    }

    // Also grab from visible images if needed
    if (rawData.images.length === 0) {
      document.querySelectorAll('.summary-photos img').forEach(img => {
        if (img.src && !rawData.images.includes(img.src)) {
          rawData.images.push(img.src);
        }
      });
    }
  }

  // Get high-resolution versions of images
  rawData.images_high_res = rawData.images.map(url => {
    // Replace thumbnail size with larger size
    return url.replace(/w=\d+&h=\d+/, 'w=1024&h=768');
  });

  // Extract broker information
  document.querySelectorAll('.property-summary-item__brokers-content .broker-info').forEach(broker => {
    const brokerData = {
      name: broker.querySelector('[itemprop="name"]')?.textContent?.trim(),
      title: broker.querySelector('[itemprop="jobTitle"]')?.textContent?.trim(),
      phone: broker.querySelector('[itemprop="telephone"]')?.textContent?.trim(),
      agency: broker.querySelector('[itemprop="legalName"]')?.textContent?.trim(),
      photo: broker.querySelector('.broker-info-broker-image')?.src,
      website: broker.querySelector('a[target="_blank"]')?.href
    };
    if (brokerData.name) {
      rawData.brokers.push(brokerData);
    }
  });
  
  // Output to console
  console.log('=== CENTRIS LISTING DATA ===');
  console.log(JSON.stringify(data, null, 2));
  
  // Copy to clipboard
  navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    .then(() => console.log('✅ JSON copied to clipboard!'))
    .catch(() => console.log('⚠️ Could not copy to clipboard. Copy the JSON above manually.'));
  
  // Also offer download
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `centris-rental-${centrisId}.json`;
  a.click();
  URL.revokeObjectURL(downloadUrl);
  console.log('✅ JSON file downloaded!');

  return data;
})();