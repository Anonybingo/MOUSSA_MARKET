// Shared image upload helper (imgbb). The API key lives here, in exactly
// one place, so every feature that uploads an image — admin product
// photos, profile pictures — calls the same function instead of each
// hardcoding its own copy of the key.

const IMGBB_API_KEY = "051353e61df035ca18ad7716fea13309";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadToImgBB(file) {
  const base64Full = await fileToBase64(file);
  const base64Data = base64Full.split(',')[1];

  const body = new FormData();
  body.append('key', IMGBB_API_KEY);
  body.append('image', base64Data);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: body
  });

  if (!res.ok) throw new Error(`imgbb responded with status ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'imgbb upload failed');

  return json.data.url;
}

// Returns null if the file is fine, or an error type the caller maps to a
// translated message ('type' = not an image, 'size' = over the limit).
export function validateImageFile(file) {
  if (!file.type.startsWith('image/')) return 'type';
  if (file.size > MAX_IMAGE_BYTES) return 'size';
  return null;
}
