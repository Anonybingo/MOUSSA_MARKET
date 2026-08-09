import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { requireAuth } from './components.js';
import { t } from './i18n.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const STAGES = ['pending', 'responded', 'negotiating', 'closed'];

function stepperHTML(status) {
  const idx = Math.max(STAGES.indexOf(status), 0);
  let html = `<div class="stepper c-${status}">`;
  STAGES.forEach((stage, i) => {
    html += `<div class="step"><span class="dot ${i <= idx ? 'filled' : ''}"></span><span class="label">${t('status_' + stage)}</span></div>`;
    if (i < STAGES.length - 1) html += `<span class="line ${i < idx ? 'filled' : ''}"></span>`;
  });
  html += `</div>`;
  return html;
}

function inquiryRowHTML(inq) {
  const thumb = inq.productImage
    ? `<img src="${escapeHtml(inq.productImage)}" alt="">`
    : `<i class="ti ti-photo" aria-hidden="true"></i>`;
  const date = inq.createdAt?.toDate ? inq.createdAt.toDate().toLocaleDateString() : '';
  const status = STAGES.includes(inq.status) ? inq.status : 'pending';
  return `
    <div class="inquiry-row">
      <div class="thumb">${thumb}</div>
      <div class="main">
        <h4>${escapeHtml(inq.productName)}</h4>
        <div class="meta">${date}</div>
      </div>
      <div class="stepper-wrap">${stepperHTML(status)}</div>
      <span class="status-badge ${status}">${t('status_' + status)}</span>
    </div>`;
}

export async function initDashboard() {
  const mount = document.getElementById('inquiry-list');
  if (!mount) return;
  const user = await requireAuth();

  async function render() {
    const snap = await getDocs(
      query(collection(db, 'inquiries'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
    );
    const inquiries = snap.docs.map((d) => d.data());
    mount.innerHTML = inquiries.length
      ? inquiries.map(inquiryRowHTML).join('')
      : `<div class="empty-state"><i class="ti ti-inbox" aria-hidden="true"></i><p>${t('dashboard_empty')}</p><a href="products.html" class="btn btn-navy" style="margin-top:14px; display:inline-flex;">${t('dashboard_empty_cta')}</a></div>`;
  }

  await render();
  document.addEventListener('translations-ready', render);
}
