import { db } from './firebase-config.js';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { requireAuth } from './components.js';
import { t } from './i18n.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export function formatTime(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Sends one message into conversations/{convId}/messages, and updates the
// parent conversation doc's summary fields in the same call — that summary
// (lastMessage, lastMessageAt) is what the admin conversation list sorts
// and previews by, so it has to stay in sync on every send, from both sides.
export async function sendMessage(convId, sender, text, meta = {}) {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    sender,
    text: trimmed,
    createdAt: serverTimestamp()
  });

  await setDoc(
    doc(db, 'conversations', convId),
    { lastMessage: trimmed, lastMessageAt: serverTimestamp(), lastSender: sender, ...meta },
    { merge: true }
  );
}

// Real-time subscription to one conversation's messages, oldest first.
// Returns the unsubscribe function — call it when leaving the page/thread.
export function listenToMessages(convId, callback) {
  const q = query(collection(db, 'conversations', convId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Admin-side: real-time list of every conversation, most recently active first.
export function listenToConversations(callback) {
  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// viewerRole is 'user' or 'admin' — decides which side of the thread a
// bubble lands on, since "mine" flips depending on who's looking at it.
export function messageBubbleHTML(msg, viewerRole) {
  const mine = msg.sender === viewerRole;
  const time = formatTime(msg.createdAt);
  return `
    <div class="chat-bubble-row ${mine ? 'mine' : 'theirs'}">
      <div class="chat-bubble">
        <p>${escapeHtml(msg.text)}</p>
        ${time ? `<span class="chat-bubble-time">${time}</span>` : ''}
      </div>
    </div>`;
}

// Full controller for the user-facing /chat/ page.
export async function initUserChat() {
  const messagesEl = document.getElementById('chat-messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  if (!messagesEl || !form || !input) return;

  const user = await requireAuth();

  function render(messages) {
    messagesEl.innerHTML = messages.length
      ? messages.map((m) => messageBubbleHTML(m, 'user')).join('')
      : `<p class="chat-empty">${t('chat_empty')}</p>`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  listenToMessages(user.uid, render);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value;
    if (!text.trim()) return;
    input.value = '';
    await sendMessage(user.uid, 'user', text, {
      userName: user.displayName || user.email,
      userEmail: user.email
    });
  });

  document.addEventListener('translations-ready', () => {
    // re-render whatever's currently in messagesEl's dataset would need a
    // stored copy to redo translated empty-state text; simplest correct
    // fix is just letting the next snapshot naturally repaint it, which
    // onSnapshot already guarantees on the very next change. For the empty
    // state specifically (no messages, so no future snapshot may fire),
    // nudge a repaint directly:
    if (messagesEl.querySelector('.chat-empty')) {
      messagesEl.innerHTML = `<p class="chat-empty">${t('chat_empty')}</p>`;
    }
  });
}
