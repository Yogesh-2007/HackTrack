/* ══════════════════════════════════════════════════
   NEXUS AI — Floating Chatbot Widget
   Self-contained: creates its own DOM on load.
   ══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  const history = [];

  // ── Create DOM ─────────────────────────────────────
  function init() {
    // FAB Button
    const fab = document.createElement('button');
    fab.id = 'nexus-fab';
    fab.setAttribute('aria-label', 'Open Nexus AI Chat');
    fab.innerHTML = `
      <span class="nexus-fab-icon nexus-fab-icon--chat">💬</span>
      <span class="nexus-fab-icon nexus-fab-icon--close">✕</span>
      <span class="nexus-fab-pulse"></span>
    `;
    document.body.appendChild(fab);

    // Chat Panel
    const panel = document.createElement('div');
    panel.id = 'nexus-panel';
    panel.innerHTML = `
      <div class="nexus-header">
        <div class="nexus-header-left">
          <div class="nexus-avatar">⚡</div>
          <div>
            <div class="nexus-title">Nexus AI</div>
            <div class="nexus-subtitle">HackTrack Assistant</div>
          </div>
        </div>
        <button class="nexus-close-btn" id="nexus-close" aria-label="Close chat">✕</button>
      </div>
      <div class="nexus-messages" id="nexus-messages">
        <div class="nexus-msg nexus-msg--bot">
          <div class="nexus-msg-avatar">⚡</div>
          <div class="nexus-msg-bubble">
            Hey there! 👋 I'm <strong>Nexus AI</strong>, your HackTrack assistant. Ask me anything about registration, QR codes, judging, leaderboards, or the event!
          </div>
        </div>
      </div>
      <form class="nexus-input-bar" id="nexus-form">
        <input
          type="text"
          id="nexus-input"
          class="nexus-input"
          placeholder="Ask Nexus AI anything..."
          autocomplete="off"
          maxlength="1000"
        />
        <button type="submit" class="nexus-send-btn" id="nexus-send" aria-label="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    `;
    document.body.appendChild(panel);

    // ── Event Listeners ────────────────────────────────
    fab.addEventListener('click', toggleChat);
    document.getElementById('nexus-close').addEventListener('click', toggleChat);
    document.getElementById('nexus-form').addEventListener('submit', handleSend);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) toggleChat();
    });
  }

  // ── Toggle Chat Panel ──────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    const panel = document.getElementById('nexus-panel');
    const fab = document.getElementById('nexus-fab');

    panel.classList.toggle('nexus-panel--open', isOpen);
    fab.classList.toggle('nexus-fab--active', isOpen);

    if (isOpen) {
      // Focus input when chat opens
      setTimeout(() => document.getElementById('nexus-input').focus(), 300);
    }
  }

  // ── Handle Send ────────────────────────────────────
  async function handleSend(e) {
    e.preventDefault();
    const input = document.getElementById('nexus-input');
    const msg = input.value.trim();
    if (!msg || isLoading) return;

    // Add user message to UI
    appendMessage('user', msg);
    history.push({ role: 'user', content: msg });
    input.value = '';

    // Show typing indicator
    isLoading = true;
    const typingEl = showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1) })
      });

      const data = await res.json();
      removeTyping(typingEl);

      if (data.success && data.reply) {
        appendMessage('bot', data.reply);
        history.push({ role: 'assistant', content: data.reply });
      } else {
        appendMessage('bot', data.message || 'Sorry, something went wrong. Please try again.');
      }
    } catch (err) {
      removeTyping(typingEl);
      appendMessage('bot', '⚠️ Unable to reach Nexus AI. Please check your connection and try again.');
    }

    isLoading = false;
  }

  // ── Append Message ─────────────────────────────────
  function appendMessage(role, text) {
    const container = document.getElementById('nexus-messages');
    const div = document.createElement('div');
    div.className = `nexus-msg nexus-msg--${role === 'user' ? 'user' : 'bot'}`;

    if (role === 'user') {
      div.innerHTML = `<div class="nexus-msg-bubble">${escapeHtml(text)}</div>`;
    } else {
      div.innerHTML = `
        <div class="nexus-msg-avatar">⚡</div>
        <div class="nexus-msg-bubble">${formatBotMessage(text)}</div>
      `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ── Typing Indicator ──────────────────────────────
  function showTyping() {
    const container = document.getElementById('nexus-messages');
    const div = document.createElement('div');
    div.className = 'nexus-msg nexus-msg--bot nexus-typing';
    div.innerHTML = `
      <div class="nexus-msg-avatar">⚡</div>
      <div class="nexus-msg-bubble nexus-typing-bubble">
        <span class="nexus-dot"></span>
        <span class="nexus-dot"></span>
        <span class="nexus-dot"></span>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ── Format Bot Message (basic markdown) ────────────
  function formatBotMessage(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n- /g, '\n• ')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ── Initialize on DOM Ready ────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
