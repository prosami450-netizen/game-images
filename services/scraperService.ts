import { ExtractedData } from "../types";

// PROXY CONFIGURATION
const HTML_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// Helper to clean and force high-res URLs
const forceHighResUrl = (url: string): string => {
  if (!url) return '';
  try {
    let newUrl = url.trim();
    
    // 1. Google / Android CDN (Play Store, APKCombo, Blogger)
    // Matches: lh3.googleusercontent.com, play-lh.googleusercontent.com, *.ggpht.com
    if (newUrl.match(/(googleusercontent|ggpht|blogspot)\.com/)) {
        // Check if there is a parameter section
        if (newUrl.match(/=[wshc]\d+/)) {
            return newUrl.replace(/=[wshc]\d+.*$/i, '=s0');
        }
        // If no params, append =s0 to be safe (unless it ends in a file extension like .png)
        if (!newUrl.match(/\.(png|jpg|jpeg|webp)$/i)) {
             return newUrl + '=s0';
        }
    }

    // 2. APKPure (Winudf)
    if (newUrl.includes('winudf.com')) {
        // Aggressively strip query parameters which usually control resizing (w=, h=)
        // Exceptions: token or auth params which might be required for access
        if (!newUrl.includes('token=') && !newUrl.includes('auth=')) {
             return newUrl.split('?')[0];
        }
    }
    
    return newUrl;
  } catch (e) {
    return url;
  }
};

export const fetchBlobViaProxy = async (url: string): Promise<Blob> => {
  const highResUrl = forceHighResUrl(url);
  const originalUrl = url;
  const timestamp = Date.now();
  
  // Define proxy generators
  const proxies = {
      wsrv: (u: string) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&output=png&t=${timestamp}`,
      cors: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      codetabs: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
      allorigins: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
  };

  // Strategy: 
  // 1. Try High-Res with resizing service (fastest, clean output)
  // 2. Try High-Res with raw proxies
  // 3. Fallback to Original URL with all proxies
  const strategies = [
      { u: highResUrl, p: proxies.wsrv },
      { u: highResUrl, p: proxies.cors },
      { u: highResUrl, p: proxies.codetabs },
      // Fallbacks
      { u: originalUrl, p: proxies.wsrv },
      { u: originalUrl, p: proxies.cors },
      { u: originalUrl, p: proxies.codetabs },
      { u: originalUrl, p: proxies.allorigins }
  ];

  // Remove duplicates (if highResUrl == originalUrl)
  const uniqueStrategies = strategies.filter((s, index, self) => 
    index === self.findIndex((t) => (t.u === s.u && t.p.toString() === s.p.toString()))
  );

  let lastError;

  for (const { u, p } of uniqueStrategies) {
    try {
      const proxyUrl = p(u);
      const response = await fetch(proxyUrl, { 
          referrerPolicy: 'no-referrer',
          credentials: 'omit' 
      });
      
      if (response.ok) {
        const blob = await response.blob();
        if (blob.type.includes('image')) {
            // Very small images are often errors or tracking pixels
            // Relaxed limit to 100 bytes to catch small icons but avoid 1x1 pixels
            if (blob.size < 100) continue; 
            return blob;
        }
      }
    } catch (e) {
      // console.warn(`Proxy failed for ${u}`, e); // specialized logging
      lastError = e;
    }
  }
  
  throw lastError || new Error(`Failed to load image: ${url}`);
};

export const scrapeStoreUrl = async (targetUrl: string): Promise<ExtractedData> => {
  if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
  
  const isApkCombo = targetUrl.includes('apkcombo.com');
  const isApkPure = targetUrl.includes('apkpure.com');
  const isGooglePlay = targetUrl.includes('play.google.com');

  // Fetch HTML
  let htmlText = '';
  let success = false;

  for (const proxyGen of HTML_PROXIES) {
    try {
      const fetchUrl = proxyGen(targetUrl);
      const response = await fetch(fetchUrl);
      if (response.ok) {
        htmlText = await response.text();
        if (htmlText.length > 2000) { 
           success = true;
           break; 
        }
      }
    } catch (e) {
      console.warn("Proxy attempt failed:", e);
    }
  }

  if (!success) {
    throw new Error("Unable to load the website content. It may be blocked or unavailable.");
  }
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  
  let appName: string | null = null;
  let iconUrl: string | null = null;
  let screenshotUrls: string[] = [];

  const makeAbsolute = (path: string | null) => {
    if (!path) return '';
    path = path.trim();
    if (path.startsWith('//')) return `https:${path}`;
    if (path.startsWith('/')) {
      try {
        const urlObj = new URL(targetUrl);
        return `${urlObj.origin}${path}`;
      } catch (e) { return path; }
    }
    if (!path.startsWith('http')) return ''; 
    return path;
  };

  const getLargestFromSrcset = (srcset: string | null): string | null => {
      if (!srcset) return null;
      const candidates = srcset.split(',').map(s => s.trim().split(' '));
      if (candidates.length > 0) {
          return candidates[candidates.length - 1][0];
      }
      return null;
  };

  // ==========================
  // 1. DATA EXTRACTION
  // ==========================
  
  // JSON-LD (Universal)
  try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      scripts.forEach(script => {
          try {
              const json = JSON.parse(script.textContent || '{}');
              const process = (obj: any) => {
                  if (obj['@type'] === 'SoftwareApplication' || obj['@type'] === 'MobileApplication') {
                      if (obj.name) appName = obj.name;
                      if (obj.image) {
                        const img = Array.isArray(obj.image) ? obj.image[0] : obj.image;
                        if (img && typeof img === 'string') iconUrl = img;
                      }
                  }
              };
              if (Array.isArray(json)) json.forEach(process);
              else process(json);
          } catch (e) {}
      });
  } catch (e) {}

  // App Name Fallback
  if (!appName) {
      const titleSelectors = [
          'h1[itemprop="name"]',
          'h1 span',
          'h1',
          '.app-title',
          '.title-like'
      ];
      for (const sel of titleSelectors) {
          const el = doc.querySelector(sel);
          if (el && el.textContent) {
              appName = el.textContent.trim();
              break;
          }
      }
  }

  // Icon Extraction
  if (!iconUrl) {
      const iconSelectors = [
        '.app_header .icon img', 
        '.icon img', 
        '.logo img',
        '.app-icon img',
        '.da-icon img', // APKPure specific
        '.dt-app-icon img', // Newer APKPure
        '.iconbox img', // Newer APKPure
        'img[itemprop="image"]', 
        'img[alt="Icon image"]',
        'link[rel="apple-touch-icon"]', // High quality fallback
        'meta[property="og:image"]' // Last resort
      ];
      
      for (const sel of iconSelectors) {
          const el = doc.querySelector(sel);
          if (el) {
             let attr = null;
             
             // Handle meta/link tags
             if (el.tagName === 'META') {
                 attr = el.getAttribute('content');
             } else if (el.tagName === 'LINK') {
                 attr = el.getAttribute('href');
             } else {
                 // Handle IMG tags: prioritize high-res data attributes
                 attr = getLargestFromSrcset(el.getAttribute('srcset')) || 
                        el.getAttribute('data-original') || 
                        el.getAttribute('data-src') ||
                        el.getAttribute('src') || 
                        el.getAttribute('href');
             }

             if (attr) {
                 const isGoogleMeta = isGooglePlay && sel.includes('og:image');
                 // Only skip favicons or tiny icons unless we have no other choice
                 if (!isGoogleMeta && !attr.includes('favicon')) {
                     iconUrl = attr;
                     break;
                 }
             }
          }
      }
  }

  // Icon Vacuum (Heuristic Fallback)
  if (!iconUrl) {
      const allImgs = Array.from(doc.querySelectorAll('img'));
      let bestImg: string | null = null;
      let maxScore = 0;

      for (const img of allImgs) {
          let score = 0;
          const src = getLargestFromSrcset(img.getAttribute('srcset')) || 
                      img.getAttribute('data-original') || 
                      img.getAttribute('src');
          if (!src) continue;

          // Don't pick up base64 tiny placeholders
          if (src.startsWith('data:')) continue;

          const width = parseInt(img.getAttribute('width') || '0');
          const height = parseInt(img.getAttribute('height') || '0');
          
          // Class/Alt hints
          const hints = (img.className + ' ' + (img.getAttribute('alt') || '') + ' ' + (img.parentElement?.className || '')).toLowerCase();
          
          if (hints.includes('icon')) score += 10;
          if (hints.includes('logo')) score += 5;
          
          // Geometry hints (Square is good for icons)
          if (width > 50 && width === height) score += 5;
          
          // Negative signals
          if (hints.includes('screenshot')) score -= 20;
          if (hints.includes('avatar')) score -= 5;
          if (hints.includes('star')) score -= 5;
          
          if (score > maxScore) {
              maxScore = score;
              bestImg = src;
          }
      }
      
      // Threshold for accepting a vacuumed image
      if (maxScore > 0 && bestImg) {
          iconUrl = bestImg;
      }
  }

  // ==========================
  // 2. SCREENSHOT EXTRACTION
  // ==========================

  const collect = (url: string | null) => {
      if (!url) return;
      const abs = makeAbsolute(url);
      if (!abs) return;
      
      if (abs.includes('avatar') || abs.includes('logo')) return;
      if (screenshotUrls.includes(abs)) return;
      
      screenshotUrls.push(abs);
  };

  // --- GOOGLE PLAY STORE ---
  if (isGooglePlay) {
      const images = doc.querySelectorAll('button img, [data-screenshot-item] img');
      images.forEach(img => {
          const src = getLargestFromSrcset(img.getAttribute('srcset')) || 
                      img.getAttribute('data-src') || 
                      img.getAttribute('src');
          if (src && src.includes('googleusercontent')) {
              collect(src);
          }
      });
      
      if (screenshotUrls.length === 0) {
          const allImgs = doc.querySelectorAll('img');
          allImgs.forEach(img => {
               const s = img.getAttribute('src') || '';
               if (s.includes('googleusercontent') && !s.includes('=s')) { 
                   if (img.width > 100 || !img.width) collect(s); 
               }
          });
      }
  }

  // --- APK COMBO ---
  if (isApkCombo) {
      const galleryLinks = doc.querySelectorAll('#gallery-screenshots a, .screenshots-list a');
      galleryLinks.forEach(el => collect(el.getAttribute('href')));
      if (screenshotUrls.length === 0) {
          const galleryImgs = doc.querySelectorAll('#gallery-screenshots img, .screenshots-list img');
          galleryImgs.forEach(el => collect(el.getAttribute('data-src') || el.getAttribute('src')));
      }
  }

  // --- APK PURE ---
  if (isApkPure) {
      // Prioritize HREF from lightbox links - usually the high res version
      const galleryLinks = doc.querySelectorAll('.screen-pswp a, .mp-screenshot a, .screenshot-item a, .scroll-snapshot a, a[data-fancybox]');
      galleryLinks.forEach(el => collect(el.getAttribute('href')));

      // If that failed, look at images but prioritize high-res attributes
      if (screenshotUrls.length === 0) {
          const galleryImgs = doc.querySelectorAll('.screen-pswp img, .mp-screenshot img, .screenshot-item img, .scroll-snapshot img');
          galleryImgs.forEach(el => {
              const bestSrc = el.getAttribute('data-original') || 
                              el.getAttribute('data-full-src') || 
                              el.getAttribute('src');
              collect(bestSrc);
          });
      }
  }

  // --- GENERIC FALLBACK ---
  if (screenshotUrls.length < 3) {
      const genericSelectors = [
          '[data-fancybox] > img',
          '.gallery a',
          '.screenshots a',
          '.lightbox',
          '[data-lightbox]'
      ];
      genericSelectors.forEach(sel => {
          doc.querySelectorAll(sel).forEach(el => {
               collect(el.getAttribute('href'));
               collect(el.getAttribute('data-original'));
               collect(el.getAttribute('src'));
          });
      });
  }

  // --- VACUUM MODE (Screenshots) ---
  if (screenshotUrls.length < 3) {
      const allImages = doc.querySelectorAll('img');
      allImages.forEach(img => {
          const src = getLargestFromSrcset(img.getAttribute('srcset')) || 
                      img.getAttribute('data-original') || 
                      img.getAttribute('data-src') || 
                      img.getAttribute('src');
          if (!src) return;
          
          const parentClass = img.parentElement?.className || '';
          const imgClass = img.className || '';
          const combined = (parentClass + ' ' + imgClass).toLowerCase();
          
          if (combined.includes('screen') || combined.includes('gallery') || combined.includes('shot')) {
              collect(src);
              return;
          }
          if (src.includes('screen') || src.includes('mktg')) {
              collect(src);
              return;
          }
      });
  }

  // Filter out icon from screenshots
  if (iconUrl) {
      const cleanIcon = forceHighResUrl(makeAbsolute(iconUrl));
      iconUrl = cleanIcon; 
      screenshotUrls = screenshotUrls.filter(s => forceHighResUrl(s) !== cleanIcon);
  }

  const processedScreenshots = screenshotUrls
      .map(url => makeAbsolute(url))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);

  return { 
    appName,
    iconUrl, 
    screenshotUrls: processedScreenshots 
  };
};