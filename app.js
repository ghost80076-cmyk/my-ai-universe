
const App = {
  characters: [],
  activeCharacter: null,
  currentStep: 1,
  messages: [],
  config: {},

  async init() {
    this.bindNavigation();
    this.bindBuilderUI();
    await this.loadCharacters();
    this.showView('home');
  },

  bindNavigation() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.view));
    });

    document.querySelectorAll('.filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCharacters(btn.dataset.filter);
      });
    });
  },

  bindBuilderUI() {
    document.querySelectorAll('input[name="play-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.choice-card').forEach(card => card.classList.remove('selected'));
        radio.closest('.choice-card').classList.add('selected');
      });
    });

    document.querySelectorAll('.step').forEach(step => {
      step.addEventListener('click', () => this.setStep(Number(step.dataset.step)));
    });

    document.getElementById('user-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('api-type').addEventListener('change', (e) => {
      const presets = {
        openrouter: ['https://openrouter.ai/api/v1/chat/completions', 'openai/gpt-4o-mini'],
        openai: ['https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'],
        custom: ['', ''],
        anthropic: ['ANTHROPIC_OFFICIAL_REQUIRES_PROVIDER_ADAPTER', 'claude-sonnet'],
        gemini: ['GEMINI_OFFICIAL_REQUIRES_PROVIDER_ADAPTER', 'gemini-2.5-flash']
      };
      const [url, model] = presets[e.target.value] || ['', ''];
      document.getElementById('base-url').value = url;
      document.getElementById('model-name').value = model;
    });
  },

  async loadCharacters() {
    // 靜態網站不能直接掃資料夾，因此目前用 manifest 管理角色清單。
    const res = await fetch('data/characters.json');
    const manifest = await res.json();

    const loaded = await Promise.all(manifest.map(async item => {
      const r = await fetch(item.file);
      return await r.json();
    }));

    this.characters = loaded;
    document.getElementById('home-character-count').textContent = loaded.length;
    this.renderCharacters('all');
  },

  renderCharacters(filter='all') {
    const list = document.getElementById('character-list');
    let chars = this.characters;

    if (filter === 'adult') chars = chars.filter(c => c.rating === 'adult');
    else if (filter !== 'all') chars = chars.filter(c =>
      (c.audience || []).includes(filter) || (c.categories || []).includes(filter)
    );

    if (!chars.length) {
      list.innerHTML = '<p style="color:var(--muted)">這個分類目前還沒有作品。</p>';
      return;
    }

    list.innerHTML = chars.map(c => `
      <article class="character-card" onclick="App.openCharacter('${c.id}')">
        <img src="${this.escapeAttr(c.avatar)}" alt="${this.escapeAttr(c.name)}">
        <div class="character-content">
          <div class="eyebrow">${c.rating === 'adult' ? '18+ / ADULT' : 'ORIGINAL CHARACTER'}</div>
          <h3>${this.escapeHTML(c.name)}</h3>
          <p>${this.escapeHTML(c.description)}</p>
          <div class="tags">${(c.tags || []).map(t => `<span class="tag">#${this.escapeHTML(t)}</span>`).join('')}</div>
        </div>
      </article>
    `).join('');
  },

  openCharacter(id) {
    this.activeCharacter = this.characters.find(c => c.id === id);
    if (!this.activeCharacter) return;
    this.renderDetail();
    this.showView('detail');
  },

  renderDetail() {
    const c = this.activeCharacter;
    document.getElementById('character-detail').innerHTML = `
      <div class="detail-layout">
        <img class="detail-image" src="${this.escapeAttr(c.avatar)}" alt="${this.escapeAttr(c.name)}">
        <div class="detail-copy">
          <div class="eyebrow">${c.rating === 'adult' ? '18+ CHARACTER' : 'ORIGINAL CHARACTER'}</div>
          <h1>${this.escapeHTML(c.name)}</h1>
          <div class="tags">${(c.tags || []).map(t => `<span class="tag">#${this.escapeHTML(t)}</span>`).join('')}</div>
          <p class="description">${this.escapeHTML(c.description)}</p>
          <div class="quote">${this.escapeHTML(c.quote || '')}</div>
          <div class="detail-meta">
            <div class="meta-box"><span>推薦模式</span><b>${this.escapeHTML((c.recommended_modes || []).join(' / '))}</b></div>
            <div class="meta-box"><span>內容分級</span><b>${c.rating === 'adult' ? '18+' : '一般'}</b></div>
          </div>
          <button class="primary" onclick="App.openBuilder()">開始故事</button>
        </div>
      </div>
    `;
  },

  openBuilder() {
    if (!this.activeCharacter) return;
    document.getElementById('builder-character-chip').textContent = this.activeCharacter.name;
    this.setStep(1);
    this.showView('builder');
  },

  showCharacterDetail() {
    this.showView('detail');
  },

  setStep(step) {
    this.currentStep = Math.max(1, Math.min(4, step));
    document.querySelectorAll('.builder-step').forEach(p => {
      p.classList.toggle('active', Number(p.dataset.stepPanel) === this.currentStep);
    });
    document.querySelectorAll('.step').forEach(s => {
      s.classList.toggle('active', Number(s.dataset.step) === this.currentStep);
    });

    document.getElementById('prev-step').classList.toggle('hidden', this.currentStep === 1);
    document.getElementById('next-step').classList.toggle('hidden', this.currentStep === 4);
    document.getElementById('start-story').classList.toggle('hidden', this.currentStep !== 4);
  },

  nextStep() { this.setStep(this.currentStep + 1); },
  prevStep() { this.setStep(this.currentStep - 1); },

  collectConfig() {
    return {
      mode: document.querySelector('input[name="play-mode"]:checked').value,
      persona: {
        name: document.getElementById('persona-name').value.trim(),
        gender: document.getElementById('persona-gender').value,
        identity: document.getElementById('persona-identity').value.trim(),
        relationship: document.getElementById('persona-relationship').value.trim(),
        personality: document.getElementById('persona-personality').value.trim(),
        extra: document.getElementById('persona-extra').value.trim()
      },
      api: {
        type: document.getElementById('api-type').value,
        baseUrl: document.getElementById('base-url').value.trim(),
        key: document.getElementById('api-key').value.trim(),
        model: document.getElementById('model-name').value.trim()
      },
      memory: {
        mode: document.getElementById('memory-mode').value,
        maxRounds: Number(document.getElementById('max-rounds').value || 20),
        maxContext: Number(document.getElementById('max-context').value || 64000),
        cache: document.getElementById('cache-enabled').checked
      }
    };
  },

  startStory() {
    this.config = this.collectConfig();
    this.messages = [];
    const c = this.activeCharacter;

    document.getElementById('chat-title').textContent = c.name;
    document.getElementById('chat-mode').textContent = this.config.mode === 'world' ? '世界模擬' : '單角色沉浸';
    document.getElementById('chat-persona').textContent = this.config.persona.name || '未命名玩家';
    document.getElementById('chat-model').textContent = this.config.api.model || '未設定';
    document.getElementById('usage-memory').textContent = `0/${this.config.memory.maxRounds}`;

    document.getElementById('chat-character-card').innerHTML = `
      <img src="${this.escapeAttr(c.avatar)}" alt="${this.escapeAttr(c.name)}">
      <div class="eyebrow">ACTIVE CHARACTER</div>
      <h3>${this.escapeHTML(c.name)}</h3>
    `;

    const stream = document.getElementById('chat-stream');
    stream.innerHTML = `<div class="message assistant"><div class="bubble">${c.greeting}</div></div>`;

    this.showView('chat');
  },

  buildSystemPrompt() {
    const c = this.activeCharacter;
    const p = this.config.persona || {};
    const modePrompt = this.config.mode === 'world'
      ? c.prompts.world
      : c.prompts.immersive;

    return [
      c.system_prompt,
      '',
      '【遊玩模式】',
      modePrompt,
      '',
      '【玩家 Persona】',
      `名稱：${p.name || '未指定'}`,
      `性別：${p.gender || '未指定'}`,
      `身分：${p.identity || '未指定'}`,
      `個性：${p.personality || '未指定'}`,
      `與角色的初始關係：${p.relationship || '未指定'}`,
      `其他設定：${p.extra || '無'}`,
      '',
      '不得替玩家決定台詞、心理或行動。'
    ].join('\n');
  },

  getRecentMessages() {
    const rounds = this.config.memory?.maxRounds || 20;
    if (this.config.memory?.mode === 'full') return this.messages;
    return this.messages.slice(-rounds * 2);
  },

  async sendMessage() {
    const input = document.getElementById('user-input');
    const text = input.value.trim();
    if (!text) return;

    if (!this.config.api.key) {
      alert('請先回到遊戲建立器填入 API Key。');
      return;
    }

    const stream = document.getElementById('chat-stream');
    stream.insertAdjacentHTML('beforeend',
      `<div class="message user"><div class="bubble">${this.escapeHTML(text)}</div></div>`
    );
    input.value = '';
    this.messages.push({ role:'user', content:text });

    const loadingId = `loading-${Date.now()}`;
    stream.insertAdjacentHTML('beforeend',
      `<div class="message assistant" id="${loadingId}"><div class="bubble">正在生成……</div></div>`
    );
    stream.scrollTop = stream.scrollHeight;

    try {
      // V1 先支援 OpenAI-compatible / OpenRouter 類介面。
      // Anthropic / Gemini 官方 API 會在下一版用 provider adapter 分流。
      if (['anthropic','gemini'].includes(this.config.api.type)) {
        throw new Error('目前 V1 尚未接入此官方 Provider，請先使用 OpenRouter 或 OpenAI-compatible。');
      }

      const payload = {
        model: this.config.api.model,
        messages: [
          { role:'system', content:this.buildSystemPrompt() },
          ...this.getRecentMessages()
        ]
      };

      const response = await fetch(this.config.api.baseUrl, {
        method:'POST',
        headers:{
          'Authorization':`Bearer ${this.config.api.key}`,
          'Content-Type':'application/json'
        },
        body:JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'API 回傳錯誤');

      const reply = data?.choices?.[0]?.message?.content || '模型沒有回傳內容。';
      this.messages.push({ role:'assistant', content:reply });

      document.getElementById(loadingId).outerHTML =
        `<div class="message assistant"><div class="bubble">${reply}</div></div>`;

      const usage = data.usage || {};
      document.getElementById('usage-context').textContent =
        usage.prompt_tokens ? `${usage.prompt_tokens.toLocaleString()} tok` : '—';
      document.getElementById('usage-turn').textContent =
        usage.completion_tokens ? `${usage.completion_tokens.toLocaleString()} tok` : '—';
      document.getElementById('usage-memory').textContent =
        `${Math.ceil(this.messages.length / 2)}/${this.config.memory.maxRounds}`;

      stream.scrollTop = stream.scrollHeight;
    } catch (err) {
      document.getElementById(loadingId).innerHTML =
        `<div class="bubble">連線失敗：${this.escapeHTML(err.message)}</div>`;
    }
  },

  exitChat() {
    this.showView('detail');
  },

  showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`${name}-view`);
    if (target) target.classList.add('active');
    window.scrollTo({top:0,behavior:'instant'});
  },

  escapeHTML(str='') {
    return String(str).replace(/[&<>"']/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[s]));
  },

  escapeAttr(str='') { return this.escapeHTML(str); }
};

window.addEventListener('DOMContentLoaded', () => App.init());
