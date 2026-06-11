/**
 * ChatApp — Client JS
 * Apple HIG-inspired chat interface
 * Features: Socket.io, infinite scroll, emoji picker, image paste
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────
const MESSAGES_PER_PAGE = 30;
const TYPING_DEBOUNCE   = 1500; // ms before "stop typing"

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  currentRoomId:    null,
  currentRoomName:  null,
  isLoadingMore:    false,
  hasMoreMessages:  true,
  oldestMessageId:  null,
  pendingImage:     null,  // { blob, objectUrl }
  typingTimer:      null,
  isTyping:         false,
  emojiPickerOpen:  false,
};

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dom = {
  emptyState:       $('emptyState'),
  chatInterface:    $('chatInterface'),
  chatHeader:       $('chatHeader'),
  chatHeaderIcon:   $('chatHeaderIcon'),
  chatHeaderName:   $('chatHeaderName'),
  chatHeaderDesc:   $('chatHeaderDesc'),
  messagesContainer:$('messagesContainer'),
  loadMoreSentinel: $('loadMoreSentinel'),
  loadMoreSpinner:  $('loadMoreSpinner'),
  typingIndicator:  $('typingIndicator'),
  typingText:       $('typingText'),
  chatInput:        $('chatInput'),
  sendBtn:          $('sendBtn'),
  emojiBtn:         $('emojiBtn'),
  emojiPickerWrap:  $('emojiPickerWrap'),
  pastePreview:     $('pastePreview'),
  pastePreviewImg:  $('pastePreviewImg'),
  pastePreviewName: $('pastePreviewName'),
  pasteCancelBtn:   $('pasteCancelBtn'),
  roomList:         $('roomList'),
  lightbox:         $('lightbox'),
  lightboxImg:      $('lightboxImg'),
  lightboxClose:    $('lightboxClose'),
};

// ─── Socket.io ───────────────────────────────────────────────────────────────
const socket = io({ withCredentials: true });

socket.on('connect', () => {
  console.log('🔌 Socket connecté');
  if (state.currentRoomId) {
    socket.emit('join_room', state.currentRoomId);
  }
});

socket.on('connect_error', (err) => {
  console.error('Socket error:', err.message);
});

// Receive new message
socket.on('new_message', (msg) => {
  appendMessage(msg, true);
  scrollToBottom();
});

// Typing updates
socket.on('typing_update', (users) => {
  const others = users.filter(u => u !== window.CHAT_CONFIG.username);
  if (others.length === 0) {
    dom.typingIndicator.classList.remove('visible');
    return;
  }
  const text = others.length === 1
    ? `${others[0]} est en train d'écrire…`
    : `${others.slice(0, -1).join(', ')} et ${others[others.length - 1]} écrivent…`;
  dom.typingText.textContent = text;
  dom.typingIndicator.classList.add('visible');
});

socket.on('error_message', (msg) => {
  showToast(msg, 'error');
});

// ─── Room Selection ───────────────────────────────────────────────────────────
dom.roomList.addEventListener('click', (e) => {
  const btn = e.target.closest('.room-item');
  if (!btn) return;

  const roomId   = btn.dataset.roomId;
  const roomName = btn.dataset.roomName;
  const roomIcon = btn.dataset.roomIcon;

  if (roomId === state.currentRoomId) return;

  // Update active room UI
  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');

  selectRoom(roomId, roomName, roomIcon);
});

async function selectRoom(roomId, roomName, roomIcon) {
  state.currentRoomId   = roomId;
  state.currentRoomName = roomName;
  state.hasMoreMessages = true;
  state.oldestMessageId = null;
  state.isLoadingMore   = false;

  // Show chat interface
  dom.emptyState.style.display    = 'none';
  dom.chatInterface.style.display = 'flex';

  // Update header
  dom.chatHeaderIcon.textContent = roomIcon || '💬';
  dom.chatHeaderName.textContent = `# ${roomName}`;
  dom.chatHeaderDesc.textContent = 'Salon de discussion';

  // Clear messages
  const container = dom.messagesContainer;
  while (container.lastChild && container.lastChild !== dom.loadMoreSentinel) {
    container.removeChild(container.lastChild);
  }

  // Reset typing
  dom.typingIndicator.classList.remove('visible');

  // Join socket room
  socket.emit('join_room', roomId);

  // Load initial messages
  await loadMessages(roomId, null);
  scrollToBottom(false);
}

// ─── Load Messages (infinite scroll) ─────────────────────────────────────────
async function loadMessages(roomId, beforeId) {
  if (state.isLoadingMore || !state.hasMoreMessages) return;
  state.isLoadingMore = true;
  dom.loadMoreSpinner.style.display = 'flex';

  try {
    let url = `/api/messages/${roomId}?limit=${MESSAGES_PER_PAGE}`;
    if (beforeId) url += `&before=${beforeId}`;

    const res  = await fetch(url, { credentials: 'same-origin' });
    const msgs = await res.json();

    if (!Array.isArray(msgs) || msgs.length === 0) {
      state.hasMoreMessages = false;
      dom.loadMoreSpinner.style.display = 'none';
      state.isLoadingMore = false;
      return;
    }

    if (msgs.length < MESSAGES_PER_PAGE) {
      state.hasMoreMessages = false;
    }

    state.oldestMessageId = msgs[0].id;

    // Preserve scroll position when prepending
    const prevScrollHeight = dom.messagesContainer.scrollHeight;
    const isFirstLoad = !beforeId;

    msgs.forEach((msg) => prependMessage(msg));

    if (!isFirstLoad) {
      const newScrollHeight = dom.messagesContainer.scrollHeight;
      dom.messagesContainer.scrollTop += (newScrollHeight - prevScrollHeight);
    }
  } catch (err) {
    console.error('loadMessages error:', err);
  } finally {
    dom.loadMoreSpinner.style.display = 'none';
    state.isLoadingMore = false;
  }
}

// IntersectionObserver for infinite scroll
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && state.currentRoomId && state.hasMoreMessages && !state.isLoadingMore) {
    loadMessages(state.currentRoomId, state.oldestMessageId);
  }
}, { root: dom.messagesContainer, threshold: 0.1 });

observer.observe(dom.loadMoreSentinel);

// ─── Render Messages ──────────────────────────────────────────────────────────
let lastRenderedUserId   = null;
let lastRenderedDate     = null;
let lastPrependedUserId  = null;

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildMessageEl(msg, isGrouped = false) {
  const isSent = msg.author?.id === window.CHAT_CONFIG.userId || msg.userId === window.CHAT_CONFIG.userId;
  const author  = msg.author?.username || 'Inconnu';
  const initial = author.charAt(0).toUpperCase();

  const row = document.createElement('div');
  row.className = `msg-row ${isSent ? 'sent' : ''} ${isGrouped ? 'grouped' : ''}`;
  row.dataset.msgId  = msg.id;
  row.dataset.userId = msg.author?.id || msg.userId;

  let bubbleHTML;
  if (msg.type === 'image') {
    bubbleHTML = `
      <div class="msg-bubble image-bubble">
        <img src="${escapeHtml(msg.content)}" alt="Image partagée" loading="lazy" onclick="openLightbox(this.src)" />
      </div>`;
  } else {
    bubbleHTML = `<div class="msg-bubble">${escapeHtml(msg.content)}</div>`;
  }

  row.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">${initial}</div>
    <div class="msg-content-wrap">
      ${!isSent && !isGrouped ? `<span class="msg-username">${escapeHtml(author)}</span>` : ''}
      ${bubbleHTML}
      <span class="msg-time">${formatTime(msg.createdAt)}</span>
    </div>`;

  return row;
}

function appendMessage(msg, animated = false) {
  const container = dom.messagesContainer;
  const msgDate = new Date(msg.createdAt).toDateString();

  // Date separator
  if (msgDate !== lastRenderedDate) {
    const sep = document.createElement('div');
    sep.className = 'date-separator';
    sep.innerHTML = `<span>${formatDate(msg.createdAt)}</span>`;
    container.appendChild(sep);
    lastRenderedDate   = msgDate;
    lastRenderedUserId = null;
  }

  const isGrouped = msg.author?.id === lastRenderedUserId || msg.userId === lastRenderedUserId;
  const el = buildMessageEl(msg, isGrouped);
  container.appendChild(el);
  lastRenderedUserId = msg.author?.id || msg.userId;
}

function prependMessage(msg) {
  const container = dom.messagesContainer;
  const sentinel  = dom.loadMoreSentinel;

  const el = buildMessageEl(msg, false);
  container.insertBefore(el, sentinel.nextSibling);
}

// ─── Send Message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  if (!state.currentRoomId) return;

  // Image pending
  if (state.pendingImage) {
    await uploadAndSendImage();
    return;
  }

  const text = dom.chatInput.value.trim();
  if (!text) return;

  socket.emit('send_message', { roomId: state.currentRoomId, content: text });
  dom.chatInput.value = '';
  dom.chatInput.style.height = 'auto';
  updateSendBtn();
  stopTyping();
}

async function uploadAndSendImage() {
  if (!state.pendingImage || !state.currentRoomId) return;

  try {
    const formData = new FormData();
    formData.append('image', state.pendingImage.blob, 'paste.png');

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Erreur d\'upload', 'error');
      return;
    }

    const { url } = await res.json();
    socket.emit('send_image', { roomId: state.currentRoomId, imageUrl: url });
    clearPastePreview();
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Erreur lors de l\'envoi de l\'image.', 'error');
  }
}

dom.sendBtn.addEventListener('click', sendMessage);

dom.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
dom.chatInput.addEventListener('input', () => {
  dom.chatInput.style.height = 'auto';
  dom.chatInput.style.height = Math.min(dom.chatInput.scrollHeight, 120) + 'px';
  updateSendBtn();
  handleTyping();
});

function updateSendBtn() {
  const hasText  = dom.chatInput.value.trim().length > 0;
  const hasImage = !!state.pendingImage;
  dom.sendBtn.disabled = !hasText && !hasImage;
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function handleTyping() {
  if (!state.currentRoomId) return;

  if (!state.isTyping) {
    state.isTyping = true;
    socket.emit('typing_start', { roomId: state.currentRoomId });
  }

  clearTimeout(state.typingTimer);
  state.typingTimer = setTimeout(stopTyping, TYPING_DEBOUNCE);
}

function stopTyping() {
  if (state.isTyping && state.currentRoomId) {
    state.isTyping = false;
    socket.emit('typing_stop', { roomId: state.currentRoomId });
  }
  clearTimeout(state.typingTimer);
}

// ─── Image Paste ─────────────────────────────────────────────────────────────
document.addEventListener('paste', (e) => {
  if (!state.currentRoomId) return;

  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  if (!imageItem) return;

  e.preventDefault();
  const blob = imageItem.getAsFile();
  if (!blob) return;

  if (blob.size > 5 * 1024 * 1024) {
    showToast('Image trop volumineuse (max 5 Mo)', 'error');
    return;
  }

  if (state.pendingImage?.objectUrl) {
    URL.revokeObjectURL(state.pendingImage.objectUrl);
  }

  const objectUrl = URL.createObjectURL(blob);
  state.pendingImage = { blob, objectUrl };

  dom.pastePreviewImg.src   = objectUrl;
  dom.pastePreviewName.textContent = `Image (${(blob.size / 1024).toFixed(1)} Ko)`;
  dom.pastePreview.classList.add('visible');
  updateSendBtn();
});

dom.pasteCancelBtn.addEventListener('click', clearPastePreview);

function clearPastePreview() {
  if (state.pendingImage?.objectUrl) {
    URL.revokeObjectURL(state.pendingImage.objectUrl);
  }
  state.pendingImage = null;
  dom.pastePreviewImg.src = '';
  dom.pastePreview.classList.remove('visible');
  updateSendBtn();
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
let emojiPicker = null;

dom.emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleEmojiPicker();
});

function toggleEmojiPicker() {
  if (state.emojiPickerOpen) {
    closeEmojiPicker();
    return;
  }

  // Lazy init
  if (!emojiPicker) {
    emojiPicker = document.createElement('emoji-picker');
    emojiPicker.setAttribute('class', 'light');

    // Apple-style dark theme overrides
    emojiPicker.style.setProperty('--background', '#1C1C1E');
    emojiPicker.style.setProperty('--border-color', 'rgba(84,84,88,0.4)');
    emojiPicker.style.setProperty('--button-hover-background', 'rgba(255,255,255,0.06)');
    emojiPicker.style.setProperty('--input-border-color', 'rgba(84,84,88,0.4)');
    emojiPicker.style.setProperty('--input-font-color', '#ebebf5');
    emojiPicker.style.setProperty('--input-placeholder-color', 'rgba(235,235,245,0.3)');
    emojiPicker.style.setProperty('--category-font-color', 'rgba(235,235,245,0.6)');
    emojiPicker.style.setProperty('--indicator-color', '#0A84FF');
    emojiPicker.style.setProperty('--skintone-button-background', 'transparent');

    emojiPicker.addEventListener('emoji-click', (e) => {
      const emoji = e.detail.unicode;
      const input = dom.chatInput;
      const start = input.selectionStart;
      const end   = input.selectionEnd;
      input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
      input.setSelectionRange(start + emoji.length, start + emoji.length);
      input.focus();
      updateSendBtn();
      closeEmojiPicker();
    });

    dom.emojiPickerWrap.appendChild(emojiPicker);
  }

  dom.emojiPickerWrap.style.display = 'block';
  state.emojiPickerOpen = true;
}

function closeEmojiPicker() {
  dom.emojiPickerWrap.style.display = 'none';
  state.emojiPickerOpen = false;
}

document.addEventListener('click', (e) => {
  if (state.emojiPickerOpen &&
      !dom.emojiPickerWrap.contains(e.target) &&
      e.target !== dom.emojiBtn) {
    closeEmojiPicker();
  }
});

// ─── Lightbox ─────────────────────────────────────────────────────────────────
window.openLightbox = function (src) {
  dom.lightboxImg.src = src;
  dom.lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
};

dom.lightboxClose.addEventListener('click', closeLightbox);
dom.lightbox.addEventListener('click', (e) => {
  if (e.target === dom.lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dom.lightbox.classList.contains('active')) closeLightbox();
});

function closeLightbox() {
  dom.lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scrollToBottom(smooth = true) {
  const c = dom.messagesContainer;
  if (smooth) {
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
  } else {
    c.scrollTop = c.scrollHeight;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    error: 'rgba(255,69,58,0.12)',
    info:  'rgba(10,132,255,0.12)',
  };
  const borders = {
    error: 'rgba(255,69,58,0.3)',
    info:  'rgba(10,132,255,0.3)',
  };
  const textColors = {
    error: '#FF453A',
    info:  '#0A84FF',
  };

  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    padding: .65rem 1.25rem;
    background: ${colors[type] || colors.info};
    border: 1px solid ${borders[type] || borders.info};
    border-radius: 100px;
    color: ${textColors[type] || textColors.info};
    font-size: .875rem;
    font-weight: 500;
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    animation: msg-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
