/**
 * Helper to safely resolve image URLs on localhost and production hosting (Coolify, Vercel, Railway, etc.)
 */
export function getImageUrl(imagePath) {
  if (!imagePath) return '/egg2.png';

  const rawUrl = typeof imagePath === 'string'
    ? imagePath
    : (Array.isArray(imagePath) ? imagePath[0] : (imagePath?.url || imagePath?.src || '/egg2.png'));

  if (!rawUrl || typeof rawUrl !== 'string') return '/egg2.png';

  // Absolute URLs (Cloudinary, external, data URIs, blob)
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // If URL points to localhost:5001/uploads, convert to relative /uploads/ so the Vite proxy handles it
  if (rawUrl.includes('localhost:5001/uploads/') || rawUrl.includes('localhost:5173/uploads/')) {
    const idx = rawUrl.indexOf('/uploads/');
    return rawUrl.substring(idx);
  }

  // If it's another http/https URL (production hosting), use as-is
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  // Frontend public static images (e.g. /egg2.png, /egg.png, /logo.jpeg)
  if (rawUrl.startsWith('/egg') || rawUrl.startsWith('/logo') || rawUrl.startsWith('egg') || rawUrl.startsWith('logo')) {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }

  // Uploaded backend images (e.g. /uploads/image.jpg)
  if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }

  return rawUrl;
}

export default getImageUrl;
