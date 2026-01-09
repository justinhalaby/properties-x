(async () => {
  const data = {
    extractedDate: new Date().toISOString(),
    id: null,
    url: null,
    title: null,
    price: null,
    address: null,
    buildingDetails: [],
    unitDetails: [],
    rentalLocation: null,
    description: null,
    sellerInfo: {
      name: null,
      profileUrl: null
    },
    media: {
      images: [],
      videos: []
    }
  };

  // Click all "See more" buttons to expand content
  const seeMoreButtons = document.querySelectorAll('[role="button"]');
  for (const btn of seeMoreButtons) {
    if (btn.textContent.trim() === 'See more') {
      btn.click();
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // URL and ID from current page
  data.url = window.location.href.split('?')[0];
  const idMatch = data.url.match(/\/item\/(\d+)/);
  if (idMatch) data.id = idMatch[1];

  // Title - first h1 span
  const titleEl = document.querySelector('h1 span');
  if (titleEl) data.title = titleEl.textContent.trim();

  // Price - look for the CA$ pattern
  const allSpans = document.querySelectorAll('span');
  for (const span of allSpans) {
    const text = span.textContent.trim();
    if (text.match(/^CA\$[\d,]+\s*\/\s*Month$/i)) {
      data.price = text;
      break;
    }
  }

  // Address - contains avenue/street pattern with Montreal
  for (const span of allSpans) {
    const text = span.textContent.trim();
    if (text.match(/^\d+.*,\s*Montréal,\s*QC$/i)) {
      data.address = text;
      break;
    }
  }

  // Rental Location - Method 1: Full postal code
  for (const span of allSpans) {
    const text = span.textContent.trim();
    if (text.match(/^Montréal,\s*QC,\s*[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i)) {
      data.rentalLocation = text;
      break;
    }
  }

  // Rental Location - Method 2: Neighborhood/area name fallback
  if (!data.rentalLocation) {
    for (const span of allSpans) {
      const text = span.textContent.trim();
      // Match patterns like "Ville-Marie, Montréal, QC" or "Le Plateau-Mont-Royal, Montréal, QC"
      if (text.match(/^[A-Za-zÀ-ÿ\-\s']+,\s*Montréal,\s*QC$/i) && 
          !text.match(/^\d/) && 
          text.length < 60) {
        data.rentalLocation = text;
        break;
      }
    }
  }

  // Get details from listitems
  const listItems = document.querySelectorAll('[role="listitem"]');
  const buildingKeywords = ['secured entry', 'elevator', 'parking garage', 'doorman', 'concierge', 'gym', 'pool', 'rooftop', 'security', 'intercom', 'storage', 'locker', 'bike room', 'terrace', 'sauna', 'hot tub', 'wheelchair'];
  const unitKeywords = ['apartment', 'bed', 'bath', 'square feet', 'heating', 'laundry', 'parking', 'lease', 'oven', 'refrigerator', 'dishwasher', 'air conditioning', 'cat friendly', 'dog friendly', 'pet friendly', 'balcony', 'microwave', 'central ac', 'walk-in closet', 'ac available', 'furnished', 'unfurnished', 'hardwood', 'utilities'];

  listItems.forEach(item => {
    const originalText = item.querySelector('span')?.textContent.trim();
    
    if (originalText && originalText.length < 100 && originalText.length > 2) {
      const lowerText = originalText.toLowerCase();
      
      if (buildingKeywords.some(k => lowerText.includes(k))) {
        if (!data.buildingDetails.includes(originalText)) {
          data.buildingDetails.push(originalText);
        }
      }
      
      if (unitKeywords.some(k => lowerText.includes(k))) {
        if (!data.unitDetails.includes(originalText)) {
          data.unitDetails.push(originalText);
        }
      }
    }
  });

  // Description - Method 1: Find the "Description" h2 header
  const allH2s = document.querySelectorAll('h2 span');
  for (const h2 of allH2s) {
    if (h2.textContent.trim() === 'Description') {
      let parent = h2.closest('div.xod5an3, div.x1gslohp, div[class*="x1n2onr6"]');
      if (parent) {
        const descSpan = parent.querySelector('span[dir="auto"]');
        if (descSpan && descSpan.textContent.length > 50) {
          data.description = descSpan.textContent.replace(/See (less|more)$/i, '').trim();
          break;
        }
      }
    }
  }

  // Description - Method 2: Fallback with case-insensitive matching
  if (!data.description) {
    const descriptionKeywords = [
      '🏠', 'disponible au', 'disponible à', 'disponible le', 'à proximité',
      'nearby', 'balcony', 'balcon', 'available', 'location', 'apartment',
      'bedroom', 'chambre', 'à louer', 'rent', 'metro', 'pet friendly',
      '1 month free', 'inclusions', 'parking included', 'utilities included',
      'heat included', 'hydro included', 'wifi included', 'furnished',
      'renovated', 'rénové', 'spacious', 'spacieux', 'bright', 'lumineux',
      'quiet', 'tranquille', 'close to', 'près de', 'walking distance',
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

    for (const span of allSpans) {
      const text = span.textContent.trim();
      const lowerText = text.toLowerCase();
      
      if (text.length > 100 && 
          !lowerText.includes('ca$') && 
          descriptionKeywords.some(k => lowerText.includes(k.toLowerCase()))) {
        data.description = text.replace(/See (less|more)$/i, '').trim();
        break;
      }
    }
  }

  // Seller Info
  const profileLinks = document.querySelectorAll('a[href*="/marketplace/profile/"]');
  for (const link of profileLinks) {
    const href = link.getAttribute('href');
    const nameSpan = link.querySelector('span');
    if (nameSpan && href) {
      const name = nameSpan.textContent.trim();
      if (name && !name.includes('Seller') && name.length > 2) {
        data.sellerInfo.name = name;
        data.sellerInfo.profileUrl = 'https://www.facebook.com' + href.split('?')[0];
        break;
      }
    }
  }

  // Images
  const thumbnailImages = document.querySelectorAll('[aria-label^="Thumbnail"] img');
  thumbnailImages.forEach(img => {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || '';
    if (src && src.includes('scontent') && !alt.includes('video thumbnail')) {
      if (!data.media.images.includes(src)) {
        data.media.images.push(src);
      }
    }
  });

  const photoImages = document.querySelectorAll('img[alt^="Photo of"]');
  photoImages.forEach(img => {
    const src = img.getAttribute('src');
    if (src && !data.media.images.includes(src)) {
      data.media.images.push(src);
    }
  });

  // Videos
  const videoElements = document.querySelectorAll('video[src]');
  videoElements.forEach(video => {
    const src = video.getAttribute('src');
    if (src && src.includes('video.') && !data.media.videos.includes(src)) {
      data.media.videos.push(src);
    }
  });

  const videoThumbnails = document.querySelectorAll('img[alt="video thumbnail"]');
  videoThumbnails.forEach(img => {
    const src = img.getAttribute('src');
    if (src) {
      data.media.videoThumbnails = data.media.videoThumbnails || [];
      if (!data.media.videoThumbnails.includes(src)) {
        data.media.videoThumbnails.push(src);
      }
    }
  });

  console.log(data);
})();