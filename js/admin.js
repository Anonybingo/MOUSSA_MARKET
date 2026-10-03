import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { requireAuth } from './components.js';
import { invalidateProductCache } from './products.js';
import { listenToConversations, listenToMessages, sendMessage, messageBubbleHTML } from './chat.js';
import { getSettings, updateSettings } from './settings.js';
import { t } from './i18n.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function showFieldError(el, text) {
  if (!el) return;
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

const STAGES = ['pending', 'responded', 'negotiating', 'closed'];

export async function initAdmin() {
  const root = document.getElementById('admin-root');
  if (!root) return;

  await requireAuth();

  wireTabs();
  wireProductForm();
  initAdminChat();
  initSettingsTab();
  await renderProducts();
  await renderInquiries();

  document.addEventListener('translations-ready', async () => {
    await renderProducts();
    await renderInquiries();
  });
}

function wireTabs() {
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      document.getElementById(btn.dataset.tab)?.classList.remove('hidden');
    });
  });
}

/* ---------------- Products ---------------- */

async function renderProducts() {
  const mount = document.getElementById('admin-products-list');
  if (!mount) return;
  const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));

  mount.innerHTML =
    snap.docs
      .map((d) => {
        const p = d.data();
        const thumb = p.imageUrl
          ? `<img src="${escapeHtml(p.imageUrl)}" alt="">`
          : `<i class="ti ti-photo" aria-hidden="true"></i>`;
        return `
        <div class="inquiry-row">
          <div class="thumb">${thumb}</div>
          <div class="main">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="meta">${escapeHtml(p.category || '')} &middot; ${new Intl.NumberFormat('en-RW').format(p.price || 0)} RWF</div>
          </div>
          <button class="btn btn-outline btn-sm" data-edit="${d.id}">${t('admin_edit')}</button>
          <button class="btn btn-danger btn-sm" data-delete="${d.id}">${t('admin_delete')}</button>
        </div>`;
      })
      .join('') || `<div class="empty-state"><p>—</p></div>`;

  mount.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`${t('admin_delete')}?`)) return;
      await deleteDoc(doc(db, 'products', btn.dataset.delete));
      invalidateProductCache();
      renderProducts();
    });
  });

  mount.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = snap.docs.find((d) => d.id === btn.dataset.edit);
      openProductForm(btn.dataset.edit, target?.data());
    });
  });
}

function openProductForm(id, existing) {
  const form = document.getElementById('product-form');
  if (!form) return;
  form.dataset.editId = id || '';
  form.dataset.existingImage = existing?.imageUrl || '';

  form.name.value = existing?.name || '';
  form.price.value = existing?.price || '';
  form.category.value = existing?.category || '';
  form.description.value = existing?.description || '';

  // CLEAR BOTH THE FILE INPUT AND THE HIDDEN URL INPUT
  const fileInput = document.getElementById('p-image-file');
  if (fileInput) fileInput.value = '';
  
  const hiddenUrlInput = document.getElementById('p-image-url');
  if (hiddenUrlInput) hiddenUrlInput.value = '';

  const preview = document.getElementById('product-image-preview');
  if (preview) {
    preview.innerHTML = existing?.imageUrl
      ? `<img src="${escapeHtml(existing.imageUrl)}" alt="" style="width: 100%; height: 100%; border-radius: 4px; object-fit: cover;">`
      : `<i class="ti ti-photo" aria-hidden="true"></i>`;
  }
  const hint = document.getElementById('product-image-hint');
  hint?.classList.toggle('hidden', !existing?.imageUrl);
  showFieldError(document.getElementById('product-image-error'), '');

  document.getElementById('product-form-panel')?.classList.add('show');
}

function wireProductForm() {
  const form = document.getElementById('product-form');
  if (!form) return;

  document.getElementById('add-product-btn')?.addEventListener('click', () => openProductForm(null, null));
  document.getElementById('product-form-cancel')?.addEventListener('click', () => {
    document.getElementById('product-form-panel')?.classList.remove('show');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      // READ THE URL SET BY YOUR IMGUPLOAD.JS SCRIPT, OR KEEP THE EXISTING ONE
      const hiddenUrlInput = document.getElementById('p-image-url');
      let imageUrl = form.dataset.existingImage || '';
      
      if (hiddenUrlInput && hiddenUrlInput.value) {
         imageUrl = hiddenUrlInput.value;
      }

      const data = {
        name: form.name.value.trim(),
        price: Number(form.price.value),
        category: form.category.value.trim(),
        imageUrl,
        description: form.description.value.trim()
      };

      const editId = form.dataset.editId;
      if (editId) {
        await updateDoc(doc(db, 'products', editId), data);
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      }

      invalidateProductCache();
      document.getElementById('product-form-panel')?.classList.remove('show');
      form.reset();
      renderProducts();
    } catch (err) {
      showFieldError(document.getElementById('product-image-error'), t('admin_save_error'));
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ---------------- Inquiries ---------------- */

async function renderInquiries() {
  const mount = document.getElementById('admin-inquiries-list');
  if (!mount) return;
  const snap = await getDocs(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')));

  mount.innerHTML =
    snap.docs
      .map((d) => {
        const inq = d.data();
        const status = STAGES.includes(inq.status) ? inq.status : 'pending';
        const options = STAGES.map(
          (s) => `<option value="${s}" ${status === s ? 'selected' : ''}>${t('status_' + s)}</option>`
        ).join('');
        const messagePart = inq.message ? ` &middot; &ldquo;${escapeHtml(inq.message)}&rdquo;` : '';
        return `
        <div class="inquiry-row">
          <div class="main">
            <h4>${escapeHtml(inq.productName)}</h4>
            <div class="meta">${escapeHtml(inq.userName || inq.userEmail || '')}${messagePart}</div>
          </div>
          <select class="select-inline" data-status="${d.id}">${options}</select>
        </div>`;
      })
      .join('') || `<div class="empty-state"><p>${t('admin_no_inquiries')}</p></div>`;

  mount.querySelectorAll('[data-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      await updateDoc(doc(db, 'inquiries', sel.dataset.status), { status: sel.value });
    });
  });
}

/* ---------------- Chat ---------------- */

function initAdminChat() {
  const listEl = document.getElementById('admin-chat-list');
  const placeholder = document.getElementById('admin-chat-placeholder');
  const messagesEl = document.getElementById('admin-chat-messages');
  const form = document.getElementById('admin-chat-form');
  const input = document.getElementById('admin-chat-input');
  if (!listEl || !form) return;

  let activeConvId = null;
  let unsubscribeMessages = null;

  listenToConversations((conversations) => {
    listEl.innerHTML = conversations.length
      ? conversations
          .map(
            (c) => `
        <button type="button" class="admin-chat-item ${c.id === activeConvId ? 'active' : ''}" data-conv="${c.id}">
          <span class="admin-chat-item-name">${escapeHtml(c.userName || c.userEmail || c.id)}</span>
          <span class="admin-chat-item-preview">${escapeHtml(c.lastMessage || '')}</span>
        </button>`
          )
          .join('')
      : `<p class="chat-empty">${t('admin_chat_no_conversations')}</p>`;

    listEl.querySelectorAll('[data-conv]').forEach((btn) => {
      btn.addEventListener('click', () => selectConversation(btn.dataset.conv));
    });
  });

  function selectConversation(convId) {
    activeConvId = convId;
    listEl.querySelectorAll('.admin-chat-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.conv === convId);
    });

    placeholder?.classList.add('hidden');
    messagesEl?.classList.remove('hidden');
    form.classList.remove('hidden');

    if (unsubscribeMessages) unsubscribeMessages();
    unsubscribeMessages = listenToMessages(convId, (messages) => {
      messagesEl.innerHTML = messages.map((m) => messageBubbleHTML(m, 'admin')).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConvId || !input) return;
    const text = input.value;
    if (!text.trim()) return;
    input.value = '';
    await sendMessage(activeConvId, 'admin', text);
  });
}

/* ---------------- Settings ---------------- */

function initSettingsTab() {
  const form = document.getElementById('settings-form');
  if (!form) return;
  const msg = document.getElementById('settings-msg');

  getSettings().then((settings) => {
    if (settings.whatsappNumber) form.whatsappNumber.value = settings.whatsappNumber;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await updateSettings({ whatsappNumber: form.whatsappNumber.value.trim() });
      msg.textContent = t('admin_settings_saved');
      msg.className = 'form-msg show success';
    } catch {
      msg.textContent = t('admin_save_error');
      msg.className = 'form-msg show error';
    } finally {
      submitBtn.disabled = false;
    }
  });
}