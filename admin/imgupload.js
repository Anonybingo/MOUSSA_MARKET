import { t } from '/js/i18n.js';
import { uploadToImgBB, validateImageFile } from '/js/imgbb.js';

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
    const problem = validateImageFile(file);
    if (problem) {
      setError(errorText, problem === 'type' ? t('admin_image_invalid_type') : t('admin_image_too_large'));
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