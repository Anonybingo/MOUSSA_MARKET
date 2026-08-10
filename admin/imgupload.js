const IMGBB_API_KEY = "051353e61df035ca18ad7716fea13309";

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

  if (!res.ok) throw new Error(`IMGBB RESPONDED WITH STATUS ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "IMGBB UPLOAD FAILED");

  return json.data.url;
}

document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById('p-image-file');
  const imagePreview = document.getElementById('product-image-preview');
  const imageUrlInput = document.getElementById('p-image-url');
  const errorText = document.getElementById('product-image-error');
  const progressText = document.getElementById('upload-progress');

  if (!imageInput) return;

  imageInput.addEventListener('change', async function(event) {
    const file = event.target.files[0];

    if (!file) {
      imagePreview.innerHTML = '<i class="ti ti-photo" aria-hidden="true"></i>';
      if (imageUrlInput) imageUrlInput.value = "";
      return;
    }

    // 1. LOCAL IMAGE PREVIEW
    const reader = new FileReader();
    reader.onload = function(e) {
      imagePreview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; border-radius: 4px; object-fit: cover;">`;
    };
    reader.readAsDataURL(file);

    // 2. UPLOAD TO IMGBB AND SET URL TO HIDDEN FORM FIELD
    if (progressText) progressText.style.display = "block";
    if (errorText) errorText.textContent = "";

    try {
      const uploadedUrl = await uploadToImgBB(file);
      if (imageUrlInput) imageUrlInput.value = uploadedUrl;
      if (progressText) progressText.textContent = "Upload complete!";
    } catch (err) {
      if (errorText) errorText.textContent = "Upload failed: " + err.message;
      if (progressText) progressText.style.display = "none";
    }
  });
});