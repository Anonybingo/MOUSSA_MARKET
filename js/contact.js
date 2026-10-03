// Shared "Contact us" entry point. Builds a modal once (lazy, like
// loader.js) and exposes openContactModal() so both the nav link and any
// product page's "Contact us" button can trigger the same 3-option menu:
// Web Chat, Send a Message, WhatsApp.
//
// Usage:
//   import { openContactModal } from '/js/contact.js';
//   openContactModal();                                   // general
//   openContactModal({ id, name, image: imageUrl });       // from a product page

import { auth, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { t } from './i18n.js';
import { getSettings } from './settings.js';

let modal = null;
let currentUser = null;
let currentProduct = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

function build() {
  if (modal) return;

  modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'contact-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${t('contact_modal_title')}</h3>
        <button type="button" class="modal-close" id="contact-modal-close" aria-label="Close">&times;</button>
      </div>

      <div id="contact-options">
        <button type="button" class="contact-option-btn" data-option="chat">
          <i class="ti ti-message-circle-2" aria-hidden="true"></i>
          <span><strong>${t('contact_option_chat_title')}</strong><small>${t('contact_option_chat_sub')}</small></span>
        </button>
        <button type="button" class="contact-option-btn" data-option="message">
          <i class="ti ti-mail" aria-hidden="true"></i>
          <span><strong>${t('contact_option_message_title')}</strong><small>${t('contact_option_message_sub')}</small></span>
        </button>
        <button type="button" class="contact-option-btn" data-option="whatsapp">
          <i class="ti ti-brand-whatsapp" aria-hidden="true"></i>
          <span><strong>${t('contact_option_whatsapp_title')}</strong><small>${t('contact_option_whatsapp_sub')}</small></span>
        </button>
      </div>

      <form id="contact-message-form" class="hidden">
        <button type="button" class="contact-back-btn" id="contact-back-btn">&larr; ${t('contact_form_back')}</button>
        <div class="field">
          <label for="contact-phone">${t('contact_form_phone_label')}</label>
          <input type="tel" id="contact-phone" name="phone" autocomplete="tel">
        </div>
        <div class="field">
          <label for="contact-message">${t('contact_modal_message_label')}</label>
          <textarea id="contact-message" name="message" placeholder="${t('contact_modal_message_placeholder')}"></textarea>
        </div>
        <button type="submit" class="btn btn-gold btn-block">${t('contact_modal_send')}</button>
        <div class="form-msg" id="contact-form-msg"></div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  wire();
}

function wire() {
  modal.querySelector('#contact-modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelectorAll('.contact-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleOption(btn.dataset.option));
  });

  modal.querySelector('#contact-back-btn').addEventListener('click', showOptions);
  modal.querySelector('#contact-message-form').addEventListener('submit', onSubmitMessage);
}

function showOptions() {
  modal.querySelector('#contact-options').classList.remove('hidden');
  modal.querySelector('#contact-message-form').classList.remove('submitted');
  modal.querySelector('#contact-message-form').classList.add('hidden');
}

async function handleOption(option) {
  if (option === 'chat') {
    if (!currentUser) {
      close();
      window.location.href = `/login/?redirect=${encodeURIComponent('/chat/')}`;
      return;
    }
    window.location.href = '/chat/';
    return;
  }

  if (option === 'whatsapp') {
    const settings = await getSettings();
    const number = (settings.whatsappNumber || '').trim();
    if (!number) return; // admin hasn't set a number yet — nothing to open

    const intro = currentProduct
      ? `${t('contact_whatsapp_text_product')} "${currentProduct.name}"`
      : t('contact_whatsapp_text_general');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(intro)}`, '_blank', 'noopener');
    close();
    return;
  }

  if (option === 'message') {
    if (!currentUser) {
      close();
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login/?redirect=${redirect}`;
      return;
    }
    modal.querySelector('#contact-options').classList.add('hidden');
    modal.querySelector('#contact-message-form').classList.remove('hidden');
  }
}

async function onSubmitMessage(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const msgEl = form.querySelector('#contact-form-msg');
  submitBtn.disabled = true;

  try {
    await addDoc(collection(db, 'inquiries'), {
      productId: currentProduct?.id || null,
      productName: currentProduct?.name || null,
      productImage: currentProduct?.image || null,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.displayName || currentUser.email,
      phone: form.phone.value.trim() || null,
      message: form.message.value.trim(),
      status: 'pending',
      createdAt: serverTimestamp()
    });
    form.classList.add('submitted');
    form.innerHTML = `<p style="padding:8px 0 4px;">${t('contact_modal_success')}</p>`;
  } catch {
    msgEl.textContent = t('contact_form_error');
    msgEl.className = 'form-msg show error';
    submitBtn.disabled = false;
  }
}

function close() {
  modal.classList.remove('show');
}

export function openContactModal(productContext) {
  build();
  currentProduct = productContext || null;
  showOptions();
  const form = modal.querySelector('#contact-message-form');
  if (!form.classList.contains('submitted')) form.reset();
  modal.classList.add('show');
}
