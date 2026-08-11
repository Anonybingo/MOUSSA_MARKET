import { t } from '/js/i18n.js';

const IMGBB_API_KEY = "051353e61df035ca18ad7716fea13309";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToImgBB(file) {
  const base64Full = await fileToBase64(file);
  const base64Data = base64Full.split(",")[1];

  const body = new FormData();
  body.append("key", IMGBB_API_KEY);
  body.append("image", base64Data);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: body
  });

  if (!res.ok) throw new Error(`imgbb responded with status ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "imgbb upload failed");

  return json.data.url;
}

function setError(errorText, message) {
  if (!errorText) return;
  errorText.textContent = message;
  errorText.style.display = message ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById('p-image-file');
  const imagePreview = document.getElementById('product-image-preview');
  const imageUrlInput = document.getElementById('p-image-url');
  const errorText = document.getElementById('product-image-error');
  const progressText = document.getElementById('upload-progress');
  const uploadWrap = document.getElementById('product-image-upload');

  if (!imageInput) return;

  imageInput.addEventListener('change', async function (event) {
    const file = event.target.files[0];
    setError(errorText, '');

    if (!file) {
      imagePreview.innerHTML = '<i class="ti ti-photo" aria-hidden="true"></i>';
      if (imageUrlInput) imageUrlInput.value = "";
      return;
    }

    // Validate before spending a network call on an upload that can't
    // succeed anyway — imgbb would just reject it a few seconds later.
    if (!file.type.startsWith('image/')) {
      setError(errorText, t('admin_image_invalid_type'));
      imageInput.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(errorText, t('admin_image_too_large'));
      imageInput.value = '';
      return;
    }

    // 1. LOCAL IMAGE PREVIEW — shown immediately, doesn't wait on the network
    const reader = new FileReader();
    reader.onload = function (e) {
      imagePreview.innerHTML = `<img src="${e.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);

    // 2. UPLOAD TO IMGBB AND SET URL TO HIDDEN FORM FIELD
    if (imageUrlInput) imageUrlInput.value = ""; // clear so a failed upload can't save a stale URL
    uploadWrap?.classList.add('uploading');
    if (progressText) { progressText.textContent = t('admin_image_uploading'); progressText.style.display = "block"; }

    try {
      const uploadedUrl = await uploadToImgBB(file);
      if (imageUrlInput) imageUrlInput.value = uploadedUrl;
    } catch (err) {
      setError(errorText, t('admin_image_upload_failed'));
    } finally {
      uploadWrap?.classList.remove('uploading');
      if (progressText) progressText.style.display = "none";
    }
  });
});