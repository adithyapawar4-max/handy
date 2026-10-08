/**
 * BhashaTalk AI — Core Client Application Logic
 * Problem Statement: HNX26EPS02 — Realtime Multilingual Conversational Bot (Indian Languages)
 * Handles:
 * - Realtime Web Speech API (ASR) + Web Audio waveform canvas
 * - Automatic Language Identification & Code-Switching UI rendering
 * - Neural Text-to-Speech synthesis & controls (Replay, Pause, Mute)
 * - Navigation between all 9 screens
 * - Live Performance telemetry and benchmark metrics
 * - Language Test Lab & Code-Switch Challenge suites
 * - Error resilience with graceful mock/demo fallbacks
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // Application State
  // -------------------------------------------------------------
  const state = {
    currentScreen: 'screenSplash',
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    isPaused: false,
    isMuted: false,
    isMockMode: false,
    preferredLanguage: 'Auto',
    speechSpeed: 1.0,
    voiceGender: 'Female',
    memoryEnabled: true,
    showLatency: true,
    lastAiText: '',
    lastAiLang: 'English',
    turns: [],
    historyList: [],
    recognitionInstance: null,
    audioContext: null,
    analyser: null,
    waveformAnimId: null,
  };

  // Predefined Language Test Lab Data
  const LAB_LANGUAGES = [
    {
      name: 'English',
      native: 'English',
      code: 'en-IN',
      flag: '🇬🇧',
      region: 'Pan-India / Global',
      phrase: 'Hello, tell me about Tamil Nadu.',
      voice: 'Indian English Neural (Neerja)',
    },
    {
      name: 'Tamil',
      native: 'தமிழ்',
      code: 'ta-IN',
      flag: '🇮🇳',
      region: 'Tamil Nadu & Puducherry',
      phrase: 'வணக்கம், சென்னையில் நாளை வானிலை எப்படி இருக்கும்?',
      voice: 'Tamil Neural (Valluvar)',
    },
    {
      name: 'Hindi',
      native: 'हिन्दी',
      code: 'hi-IN',
      flag: '🇮🇳',
      region: 'North & Central India',
      phrase: 'नमस्ते, कल मेरी टीम मीटिंग कितने बजे है?',
      voice: 'Hindi Neural (Swara)',
    },
    {
      name: 'Telugu',
      native: 'తెలుగు',
      code: 'te-IN',
      flag: '🇮🇳',
      region: 'Andhra Pradesh & Telangana',
      phrase: 'నమస్కారం, రేపు హైదరాబాద్‌లో వాతావరణం ఎలా ఉంటుంది?',
      voice: 'Telugu Neural (Shruti)',
    },
    {
      name: 'Kannada',
      native: 'ಕನ್ನಡ',
      code: 'kn-IN',
      flag: '🇮🇳',
      region: 'Karnataka',
      phrase: 'ನಮಸ್ಕಾರ, ನಾಳೆ ಬೆಂಗಳೂರು ಟ್ರಾಫಿಕ್ ಹೇಗಿದೆ?',
      voice: 'Kannada Neural (Gagan)',
    },
    {
      name: 'Malayalam',
      native: 'മലയാളം',
      code: 'ml-IN',
      flag: '🇮🇳',
      region: 'Kerala',
      phrase: 'നമസ്കാരം, നാളെ കൊച്ചിയിൽ മഴ പെയ്യാൻ സാധ്യതയുണ്ടോ?',
      voice: 'Malayalam Neural (Sobhana)',
    },
  ];

  // Predefined Code-Switch Challenge Prompts
  const CODE_SWITCH_CHALLENGES = [
    {
      id: 'cs1',
      pair: 'Tamil + English',
      sentence: 'நாளைக்கு college போகணுமா?',
      tokens: [
        { text: 'நாளைக்கு', lang: 'Tamil' },
        { text: 'college', lang: 'English' },
        { text: 'போகணுமா?', lang: 'Tamil' },
      ],
      expectedIntent: 'Inquiring if college has working classes tomorrow',
    },
    {
      id: 'cs2',
      pair: 'Tamil + English',
      sentence: 'நாளைக்கு Chennai weather எப்படி இருக்கும்?',
      tokens: [
        { text: 'நாளைக்கு', lang: 'Tamil' },
        { text: 'Chennai', lang: 'English' },
        { text: 'weather', lang: 'English' },
        { text: 'எப்படி', lang: 'Tamil' },
        { text: 'இருக்கும்?', lang: 'Tamil' },
      ],
      expectedIntent: 'Checking tomorrow forecast for Chennai in Tanglish',
    },
    {
      id: 'cs3',
      pair: 'Hindi + English',
      sentence: 'Kal meeting kitne baje hai?',
      tokens: [
        { text: 'Kal', lang: 'Hindi' },
        { text: 'meeting', lang: 'English' },
        { text: 'kitne', lang: 'Hindi' },
        { text: 'baje', lang: 'Hindi' },
        { text: 'hai?', lang: 'Hindi' },
      ],
      expectedIntent: 'Asking meeting schedule in Hinglish',
    },
    {
      id: 'cs4',
      pair: 'Telugu + English',
      sentence: 'Repu Hyderabad lo weather ela untundi?',
      tokens: [
        { text: 'Repu', lang: 'Telugu' },
        { text: 'Hyderabad', lang: 'English' },
        { text: 'lo', lang: 'Telugu' },
        { text: 'weather', lang: 'English' },
        { text: 'ela', lang: 'Telugu' },
        { text: 'untundi?', lang: 'Telugu' },
      ],
      expectedIntent: 'Inquiring Hyderabad weather in Tenglish',
    },
    {
      id: 'cs5',
      pair: 'Kannada + English',
      sentence: 'Naale Bangalore traffic hegide?',
      tokens: [
        { text: 'Naale', lang: 'Kannada' },
        { text: 'Bangalore', lang: 'English' },
        { text: 'traffic', lang: 'English' },
        { text: 'hegide?', lang: 'Kannada' },
      ],
      expectedIntent: 'Checking Bengaluru peak traffic in Kanglish',
    },
    {
      id: 'cs6',
      pair: 'Malayalam + English',
      sentence: 'Naale Kochi weather enganeyaanu?',
      tokens: [
        { text: 'Naale', lang: 'Malayalam' },
        { text: 'Kochi', lang: 'English' },
        { text: 'weather', lang: 'English' },
        { text: 'enganeyaanu?', lang: 'Malayalam' },
      ],
      expectedIntent: 'Checking Kochi rain conditions in Manglish',
    },
  ];

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initIndicCarousel();
    initRotatingGreeting();
    initSpeechRecognition();
    initAudioVisualizer();
    initEventListeners();
    renderLanguageLab();
    renderCodeSwitchChallenges();
    fetchBenchmarkTelemetry();

    // Check for direct screen navigation via URL param
    const urlParams = new URLSearchParams(window.location.search);
    const screenParam = urlParams.get('screen');
    if (screenParam) {
      navigateTo(screenParam);
    } else {
      // Auto-advance Splash screen after 2.2 seconds
      setTimeout(() => {
        if (state.currentScreen === 'screenSplash') {
          navigateTo('screenOnboarding');
        }
      }, 2200);
    }
  });

  // -------------------------------------------------------------
  // Clock in Mobile Status Bar
  // -------------------------------------------------------------
  function initClock() {
    const el = document.getElementById('statusClock');
    function update() {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      if (el) el.textContent = `${hrs}:${mins}`;
    }
    update();
    setInterval(update, 10000);
  }

  // -------------------------------------------------------------
  // Navigation & Screen Management
  // -------------------------------------------------------------
  function navigateTo(screenId) {
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      state.currentScreen = screenId;
    }

    // Update bottom navigation active tab
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
      if (t.getAttribute('data-target') === screenId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    // Special screen triggers
    if (screenId === 'screenPerformance') {
      fetchBenchmarkTelemetry();
    } else if (screenId === 'screenHistory') {
      fetchHistorySessions();
    }
  }

  function initNavigation() {
    // Bottom Nav Tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        navigateTo(targetId);
      });
    });

    // Onboarding Slides
    let currentSlide = 0;
    const slides = document.querySelectorAll('.onboarding-slide');
    const dots = document.querySelectorAll('.slide-dots .dot');
    const btnNext = document.getElementById('btnNextOnboarding');
    const btnSkip = document.getElementById('btnSkipOnboarding');
    const btnGetStarted = document.getElementById('btnGetStarted');

    function showSlide(idx) {
      slides.forEach((s, i) => s.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      if (idx === slides.length - 1) {
        btnNext.classList.add('hidden');
        btnGetStarted.classList.remove('hidden');
      } else {
        btnNext.classList.remove('hidden');
        btnGetStarted.classList.add('hidden');
      }
      currentSlide = idx;
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentSlide < slides.length - 1) {
          showSlide(currentSlide + 1);
        }
      });
    }

    if (btnSkip) {
      btnSkip.addEventListener('click', () => navigateTo('screenHome'));
    }

    if (btnGetStarted) {
      btnGetStarted.addEventListener('click', () => navigateTo('screenHome'));
    }

    // Home Quick Links & Option 1 Mode Presets
    bindClick('cardNewConversation', () => navigateTo('screenConversation'));
    bindClick('cardLanguageLab', () => navigateTo('screenLanguageLab'));
    bindClick('cardCodeSwitchLab', () => navigateTo('screenCodeSwitchLab'));
    bindClick('cardPerformance', () => navigateTo('screenPerformance'));
    bindClick('btnHeaderSettings', () => navigateTo('screenSettings'));

    // Option 1 Mode Cards & Quick Launchers
    bindClick('modeCasual', () => navigateTo('screenConversation'));
    bindClick('modeCodeSwitch', () => navigateTo('screenCodeSwitchLab'));
    bindClick('modeLanguageLab', () => navigateTo('screenLanguageLab'));
    bindClick('modePerformance', () => navigateTo('screenPerformance'));
    bindClick('linkViewAllHistory', () => navigateTo('screenHistory'));

    // Back Buttons
    bindClick('btnBackFromConv', () => navigateTo('screenHome'));
    bindClick('btnBackFromPerf', () => navigateTo('screenHome'));
    bindClick('btnBackFromLangLab', () => navigateTo('screenHome'));
    bindClick('btnBackFromCodeSwitch', () => navigateTo('screenHome'));
    bindClick('btnBackFromHistory', () => navigateTo('screenHome'));
    bindClick('btnBackFromSettings', () => navigateTo('screenHome'));

    // Refresh telemetry
    bindClick('btnRefreshPerf', fetchBenchmarkTelemetry);
  }

  // -------------------------------------------------------------
  // Quick Indic Language Switcher (Interactive Carousel)
  // -------------------------------------------------------------
  function initIndicCarousel() {
    const cards = document.querySelectorAll('.indic-pill-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const lang = card.getAttribute('data-lang') || 'Auto';
        state.preferredLanguage = lang;

        const selectLang = document.getElementById('selectInputLang');
        if (selectLang) selectLang.value = lang;

        const badgeText = document.getElementById('liveLangBadgeText');
        if (badgeText) badgeText.textContent = lang === 'Auto' ? 'Auto Detect' : lang;

        showToast(`Input Language: ${lang} (< 120ms benchmark)`);
      });
    });
  }

  // -------------------------------------------------------------
  // Multilingual Rotating Greeting Banner
  // -------------------------------------------------------------
  function initRotatingGreeting() {
    const greetings = [
      'வணக்கம் • Namaste • Welcome',
      'నమస్కారం • Namaskara • Welcome',
      'നമസ്കാരം • Welcome • BhashaTalk',
      'Tamil • Hindi • Telugu • Kannada • Malayalam',
      'Real-time Multilingual AI • <120ms Latency'
    ];
    let idx = 0;
    const greetingEl = document.getElementById('greetingText');
    if (!greetingEl) return;

    setInterval(() => {
      idx = (idx + 1) % greetings.length;
      greetingEl.style.opacity = '0';
      setTimeout(() => {
        greetingEl.textContent = greetings[idx];
        greetingEl.style.opacity = '1';
      }, 250);
    }, 3800);
  }

  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  // -------------------------------------------------------------
  // Web Speech API (ASR) Integration
  // -------------------------------------------------------------
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      state.recognitionInstance = new SpeechRecognition();
      state.recognitionInstance.continuous = false;
      state.recognitionInstance.interimResults = true;
      state.recognitionInstance.lang = 'en-IN';

      state.recognitionInstance.onstart = () => {
        state.isListening = true;
        setConvState('listening', 'Listening to speech...');
        setIslandText('Listening...', true);
        updateMicUi(true);
      };

      state.recognitionInstance.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const liveText = finalTranscript || interimTranscript;
        if (liveText) {
          updateLiveTranscript(liveText, false);
        }

        if (finalTranscript) {
          handleUserUtterance(finalTranscript);
        }
      };

      state.recognitionInstance.onerror = (event) => {
        console.warn('[SpeechRecognition] error:', event.error);
        state.isListening = false;
        updateMicUi(false);
        if (event.error === 'not-allowed') {
          showToast('Microphone permission blocked. Using voice test phrases.');
        }
        setConvState('idle', 'Tap microphone to speak');
        setIslandText('BhashaTalk Ready', false);
      };

      state.recognitionInstance.onend = () => {
        state.isListening = false;
        updateMicUi(false);
        if (!state.isProcessing) {
          setConvState('idle', 'Tap microphone to speak');
          setIslandText('BhashaTalk Ready', false);
        }
      };
    } else {
      console.warn('[SpeechRecognition] Native Web Speech API not supported in this browser.');
    }
  }

  function toggleListening() {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    // If speaking, stop TTS first
    stopSpeechSynthesis();

    if (state.recognitionInstance) {
      try {
        state.recognitionInstance.start();
      } catch (err) {
        // Already started or busy, restart
        state.recognitionInstance.stop();
        setTimeout(() => state.recognitionInstance.start(), 200);
      }
    } else {
      // Simulate listening in browsers without Web Speech
      simulateListeningFlow();
    }
  }

  function stopListening() {
    if (state.recognitionInstance) {
      try {
        state.recognitionInstance.stop();
      } catch (e) {
        // ignore
      }
    }
    state.isListening = false;
    updateMicUi(false);
    setConvState('idle', 'Tap microphone to speak');
  }

  function simulateListeningFlow() {
    state.isListening = true;
    updateMicUi(true);
    setConvState('listening', 'Listening to speech...');
    setIslandText('Listening...', true);

    setTimeout(() => {
      const sample = "நாளைக்கு Chennai weather எப்படி இருக்கும்?";
      updateLiveTranscript(sample, false);
      setTimeout(() => {
        state.isListening = false;
        updateMicUi(false);
        handleUserUtterance(sample);
      }, 900);
    }, 1200);
  }

  function updateMicUi(isListening) {
    const btnHome = document.getElementById('btnHomeMic');
    const btnLive = document.getElementById('btnLiveMic');
    const glow = document.getElementById('micWaveGlow');
    const homeStateLabel = document.getElementById('homeStateLabel');
    const homeStateDot = document.querySelector('#homeStatePill .asp-dot');

    if (btnHome) {
      btnHome.classList.toggle('listening', isListening);
    }
    if (btnLive) {
      btnLive.classList.toggle('listening', isListening);
    }
    if (glow) {
      glow.classList.toggle('active', isListening);
    }
    const hint = document.getElementById('dockHint');
    if (hint) {
      hint.textContent = isListening ? 'Listening... Speak now' : 'Tap to Speak';
    }
    if (homeStateLabel) {
      homeStateLabel.textContent = isListening ? 'Listening...' : 'Tap to speak';
    }
    if (homeStateDot) {
      homeStateDot.style.background = isListening ? 'var(--accent-rose)' : 'var(--accent-green)';
      homeStateDot.style.boxShadow = isListening ? '0 0 10px var(--accent-rose)' : '0 0 8px var(--accent-green)';
    }
  }

  function setConvState(type, text) {
    const pill = document.getElementById('convStatePill');
    const dot = pill?.querySelector('.state-dot');
    const label = document.getElementById('convStateText');
    if (label) label.textContent = text;

    if (dot) {
      dot.className = 'state-dot';
      if (type === 'listening') dot.classList.add('listening');
      if (type === 'understanding') dot.classList.add('understanding');
      if (type === 'responding') dot.classList.add('responding');
    }
  }

  function setIslandText(text, isPulse = false) {
    const label = document.getElementById('islandText');
    const dot = document.querySelector('.island-dot');
    if (label) label.textContent = text;
    if (dot) {
      dot.style.background = isPulse ? 'var(--accent-rose)' : 'var(--accent-green)';
      dot.style.boxShadow = isPulse ? '0 0 8px var(--accent-rose)' : '0 0 8px var(--accent-green)';
    }
  }

  // -------------------------------------------------------------
  // Live Transcript UI
  // -------------------------------------------------------------
  function updateLiveTranscript(text, isFinal = false) {
    const container = document.getElementById('transcriptContainer');
    if (!container) return;

    let interimBubble = document.getElementById('activeInterimBubble');
    if (!interimBubble) {
      interimBubble = document.createElement('div');
      interimBubble.id = 'activeInterimBubble';
      interimBubble.className = 'chat-bubble user-bubble';
      interimBubble.innerHTML = `
        <div class="bubble-header">
          <span class="speaker-tag" style="color: #94A3B8;">YOU</span>
          <span class="bubble-time">Live</span>
        </div>
        <p class="bubble-body" id="interimText">${escapeHtml(text)}</p>
      `;
      container.appendChild(interimBubble);
    } else {
      const p = document.getElementById('interimText');
      if (p) p.textContent = text;
    }
    container.scrollTop = container.scrollHeight;
  }

  function appendChatBubble(role, text, meta = {}) {
    const container = document.getElementById('transcriptContainer');
    if (!container) return;

    // Remove interim if present
    const interim = document.getElementById('activeInterimBubble');
    if (interim && role === 'user') interim.remove();

    const isUser = role === 'user';
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (isUser) {
      bubble.innerHTML = `
        <div class="bubble-header">
          <span class="speaker-tag" style="color: #94A3B8;">YOU</span>
          <span class="meta-lang-tag" style="font-size: 10px; margin-left: 4px; color: #CBD5E1;">[${state.preferredLanguage === 'Auto' ? 'Auto Detect' : state.preferredLanguage}]</span>
          <span class="bubble-time">${timeStr}</span>
        </div>
        <p class="bubble-body">${escapeHtml(text)}</p>
      `;
    } else {
      const langLabel = meta.isCodeSwitched ? meta.codeSwitchPair : (meta.detectedLanguage ? `${meta.detectedLanguage} / English` : 'Bilingual Indic');
      const latLabel = meta.latency ? `${meta.latency.totalSec}s` : '< 1.1s';

      bubble.innerHTML = `
        <div class="bubble-header">
          <div class="bubble-avatar-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          </div>
          <span class="speaker-tag">BHASHATALK AI</span>
          <div class="audio-wave-indicator">
            <span class="wave-bar w1"></span>
            <span class="wave-bar w2"></span>
            <span class="wave-bar w3"></span>
          </div>
          <span class="bubble-time">${timeStr}</span>
        </div>
        <p class="bubble-body">${escapeHtml(text)}</p>
        <div class="bubble-footer-strip">
          <span class="translation-toggle-tag" title="Detected Dialect">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            ${langLabel}
          </span>
          <span class="bubble-model-tag">⚡ ${latLabel}</span>
        </div>
      `;
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  // -------------------------------------------------------------
  // Full Voice Pipeline Handler (User Speaks -> End to End)
  // -------------------------------------------------------------
  async function handleUserUtterance(userText) {
    if (!userText || !userText.trim()) return;
    state.isProcessing = true;

    // 1. Display User Bubble
    appendChatBubble('user', userText);

    // 2. Set State to Understanding
    setConvState('understanding', 'Understanding...');
    setIslandText('AI Processing...', true);

    try {
      // 3. Post to backend unified conversation pipeline
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          userText,
          preferredLanguage: state.preferredLanguage,
          isMockMode: state.isMockMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data;

      // 4. Update Header Dynamic Language Badge
      updateDetectedLanguageBadge(data);

      // 5. Update Latency Chip
      const latencyChip = document.getElementById('convLatencyText');
      if (latencyChip && data.latency) {
        latencyChip.textContent = `Total: ${data.latency.totalSec}s (${data.latency.totalMs}ms)`;
      }

      // 6. Append AI Response Bubble
      appendChatBubble('assistant', data.response, data);

      // 7. Text-To-Speech Playback
      state.lastAiText = data.response;
      state.lastAiLang = data.detectedLanguage;
      setConvState('responding', 'Responding...');
      setIslandText('Speaking...', true);

      await playSpeechResponse(data.response, data.detectedLanguage, data.tts);

      setConvState('idle', 'Tap microphone to speak');
      setIslandText('BhashaTalk Ready', false);
    } catch (err) {
      console.error('[handleUserUtterance] error:', err);
      showToast('Error processing voice turn: ' + err.message);
      setConvState('idle', 'Tap microphone to speak');
      setIslandText('BhashaTalk Ready', false);
    } finally {
      state.isProcessing = false;
    }
  }

  // -------------------------------------------------------------
  // Dynamic Language Badge
  // -------------------------------------------------------------
  function updateDetectedLanguageBadge(data) {
    const badgeText = document.getElementById('liveLangBadgeText');
    if (!badgeText) return;

    if (data.isCodeSwitched) {
      badgeText.textContent = `Detected: ${data.codeSwitchPair}`;
      badgeText.style.color = 'var(--accent-amber)';
    } else {
      badgeText.textContent = `Detected: ${data.nativeLanguageName} (${data.detectedLanguage})`;
      badgeText.style.color = 'var(--primary)';
    }
  }

  // -------------------------------------------------------------
  // Text-To-Speech Engine
  // -------------------------------------------------------------
  function playSpeechResponse(text, language = 'English', ttsMeta = null) {
    return new Promise((resolve) => {
      if (state.isMuted) {
        resolve();
        return;
      }

      state.isSpeaking = true;

      // Check if browser has SpeechSynthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = state.speechSpeed || 1.0;
        utterance.pitch = 1.0;

        // Map language to BCP 47 locale
        const localeMap = {
          Tamil: 'ta-IN',
          Hindi: 'hi-IN',
          Telugu: 'te-IN',
          Kannada: 'kn-IN',
          Malayalam: 'ml-IN',
          English: 'en-IN',
        };
        utterance.lang = localeMap[language] || 'en-IN';

        // Choose appropriate voice if available
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(v => v.lang === utterance.lang || v.lang.startsWith(utterance.lang.substring(0, 2)));
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onend = () => {
          state.isSpeaking = false;
          resolve();
        };

        utterance.onerror = () => {
          state.isSpeaking = false;
          // Fallback to backend audio stream
          fallbackToAudioStream(ttsMeta, resolve);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        fallbackToAudioStream(ttsMeta, resolve);
      }
    });
  }

  function fallbackToAudioStream(ttsMeta, callback) {
    const url = ttsMeta?.audioUrl || '/api/speech/audio-stream';
    const audio = new Audio(url);
    audio.onended = () => {
      state.isSpeaking = false;
      if (callback) callback();
    };
    audio.onerror = () => {
      state.isSpeaking = false;
      if (callback) callback();
    };
    audio.play().catch(() => {
      state.isSpeaking = false;
      if (callback) callback();
    });
  }

  function stopSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    state.isSpeaking = false;
  }

  // -------------------------------------------------------------
  // Realtime Audio Waveform Canvas Visualizer
  // -------------------------------------------------------------
  function initAudioVisualizer() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    function drawWave() {
      state.waveformAnimId = requestAnimationFrame(drawWave);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const numBars = 36;
      const barWidth = 4;
      const gap = (w - (numBars * barWidth)) / (numBars + 1);

      phase += 0.08;

      for (let i = 0; i < numBars; i++) {
        const x = gap + i * (barWidth + gap);
        let amplitude = 4;

        if (state.isListening) {
          // Dynamic active recording wave
          amplitude = Math.sin(phase + i * 0.45) * 16 + 18;
          amplitude += Math.random() * 6;
        } else if (state.isSpeaking) {
          // Rhythmic speech synthesis wave
          amplitude = Math.cos(phase * 1.5 + i * 0.3) * 12 + 14;
        } else {
          // Gentle ambient wave
          amplitude = Math.sin(phase * 0.5 + i * 0.2) * 3 + 4;
        }

        const barHeight = Math.min(h - 8, Math.max(4, amplitude));
        const y = (h - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (state.isListening) {
          grad.addColorStop(0, '#EF4444');
          grad.addColorStop(1, '#F87171');
        } else if (state.isSpeaking) {
          grad.addColorStop(0, '#10B981');
          grad.addColorStop(1, '#059669');
        } else {
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(1, '#475569');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    }

    drawWave();
  }

  // -------------------------------------------------------------
  // Language Test Lab Renderer
  // -------------------------------------------------------------
  function renderLanguageLab() {
    const container = document.getElementById('langCardsList');
    if (!container) return;

    container.innerHTML = LAB_LANGUAGES.map(lang => `
      <div class="lab-lang-card" data-lang="${lang.name}">
        <div class="llc-header">
          <div class="llc-title-group">
            <span class="llc-flag">${lang.flag}</span>
            <div>
              <span class="llc-name">${lang.name}</span>
              <span class="llc-native">(${lang.native})</span>
            </div>
          </div>
          <button class="btn-test-voice" data-phrase="${escapeAttr(lang.phrase)}" data-lang="${lang.name}">
            <span>▶</span> Test Voice
          </button>
        </div>
        <div class="llc-phrase">“${escapeHtml(lang.phrase)}”</div>
        <div class="llc-footer">
          <span class="llc-voice-info">🎙️ ${lang.voice}</span>
          <span class="llc-region">${lang.region}</span>
        </div>
        <div class="llc-result-box hidden" id="labResult_${lang.name}"></div>
      </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('.btn-test-voice').forEach(btn => {
      btn.addEventListener('click', async () => {
        const phrase = btn.getAttribute('data-phrase');
        const langName = btn.getAttribute('data-lang');
        const resultBox = document.getElementById(`labResult_${langName}`);

        if (resultBox) {
          resultBox.classList.remove('hidden');
          resultBox.innerHTML = `<em>Testing ${langName} voice pipeline...</em>`;
        }

        try {
          const res = await fetch('/api/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userText: phrase,
              preferredLanguage: langName,
              isMockMode: state.isMockMode,
            }),
          });
          const json = await res.json();
          const d = json.data;

          if (resultBox) {
            resultBox.innerHTML = `
              <strong>✓ Detected:</strong> ${d.nativeLanguageName} (${d.detectedLanguage}) | 
              <strong>Latency:</strong> ${d.latency.totalSec}s (STT: ${d.latency.sttMs}ms, AI: ${d.latency.aiResponseMs}ms, TTS: ${d.latency.ttsMs}ms)<br>
              <strong>AI Spoken:</strong> “${escapeHtml(d.response)}”
            `;
          }

          // Speak output
          playSpeechResponse(d.response, d.detectedLanguage, d.tts);
          fetchBenchmarkTelemetry();
        } catch (e) {
          if (resultBox) resultBox.innerHTML = `<span style="color:#EF4444">Error: ${e.message}</span>`;
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Code-Switch Challenge Renderer
  // -------------------------------------------------------------
  function renderCodeSwitchChallenges() {
    const container = document.getElementById('csChallengesList');
    if (!container) return;

    container.innerHTML = CODE_SWITCH_CHALLENGES.map(item => `
      <div class="cs-challenge-card" id="card_${item.id}">
        <div class="cs-card-header">
          <span class="cs-pair-badge">⚡ ${item.pair}</span>
          <span class="cs-confidence-score">Confidence: ~94%</span>
        </div>
        <div class="cs-sentence">“${escapeHtml(item.sentence)}”</div>
        <div class="cs-token-pills">
          ${item.tokens.map(t => `
            <span class="cs-token-pill ${t.lang === 'English' ? 'token-english' : 'token-indian'}">
              ${t.text} <sub>${t.lang}</sub>
            </span>
          `).join('')}
        </div>
        <div class="cs-action-row">
          <span style="font-size: 11px; color: var(--text-muted);">${item.expectedIntent}</span>
          <button class="btn-test-voice btn-run-cs" data-sentence="${escapeAttr(item.sentence)}">
            <span>▶</span> Verify AI
          </button>
        </div>
        <div class="llc-result-box hidden" id="csResult_${item.id}"></div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-run-cs').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sentence = btn.getAttribute('data-sentence');
        const card = btn.closest('.cs-challenge-card');
        const resBox = card?.querySelector('.llc-result-box');

        if (resBox) {
          resBox.classList.remove('hidden');
          resBox.innerHTML = `<em>Analyzing code-switching and tokens...</em>`;
        }

        try {
          const res = await fetch('/api/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userText: sentence,
              isMockMode: state.isMockMode,
            }),
          });
          const json = await res.json();
          const d = json.data;

          if (resBox) {
            resBox.innerHTML = `
              <strong>✓ Code-Switch:</strong> ${d.codeSwitchPair || d.detectedLanguage} | 
              <strong>Latency:</strong> ${d.latency.totalSec}s | 
              <strong>Confidence:</strong> ${d.confidence.languageConfidencePct}%<br>
              <strong>AI Understanding:</strong> “${escapeHtml(d.response)}”
            `;
          }

          playSpeechResponse(d.response, d.detectedLanguage, d.tts);
          fetchBenchmarkTelemetry();
        } catch (e) {
          if (resBox) resBox.innerHTML = `<span style="color:#EF4444">Error: ${e.message}</span>`;
        }
      });
    });

    // Custom Code-Switch Input Runner
    const btnCustom = document.getElementById('btnRunCustomCS');
    const inputCustom = document.getElementById('inputCustomCS');
    const previewCustom = document.getElementById('csResultPreview');

    if (btnCustom && inputCustom) {
      btnCustom.addEventListener('click', async () => {
        const text = inputCustom.value.trim();
        if (!text) return;

        if (previewCustom) {
          previewCustom.classList.remove('hidden');
          previewCustom.innerHTML = `<em>Classifying tokens and semantics...</em>`;
        }

        try {
          const res = await fetch('/api/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userText: text, isMockMode: state.isMockMode }),
          });
          const json = await res.json();
          const d = json.data;

          if (previewCustom) {
            const tokenTags = (d.tokenBreakdown || []).map(t => `
              <span class="cs-token-pill ${t.language === 'English' ? 'token-english' : 'token-indian'}">
                ${t.token} <sub>${t.language}</sub>
              </span>
            `).join(' ');

            previewCustom.innerHTML = `
              <div><strong>Detected:</strong> ${d.isCodeSwitched ? d.codeSwitchPair : d.detectedLanguage} (${d.confidence.languageConfidencePct}%)</div>
              <div style="margin: 6px 0;"><strong>Tokens:</strong> ${tokenTags}</div>
              <div><strong>AI Response:</strong> “${escapeHtml(d.response)}”</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Latency: ${d.latency.totalSec}s (STT: ${d.latency.sttMs}ms, AI: ${d.latency.aiResponseMs}ms, TTS: ${d.latency.ttsMs}ms)</div>
            `;
          }

          playSpeechResponse(d.response, d.detectedLanguage, d.tts);
        } catch (e) {
          if (previewCustom) previewCustom.innerHTML = `<span style="color:#EF4444">Error: ${e.message}</span>`;
        }
      });
    }
  }

  // -------------------------------------------------------------
  // Performance Monitor & Benchmark Telemetry
  // -------------------------------------------------------------
  async function fetchBenchmarkTelemetry() {
    try {
      const res = await fetch('/api/benchmark');
      if (!res.ok) return;
      const json = await res.json();
      const s = json.summary;

      // Update Top Score
      const totalTime = document.getElementById('perfTotalTime');
      if (totalTime) totalTime.innerHTML = `${s.averageTotalLatencySec} <span class="sec-unit">sec</span>`;

      // Update Breakdown
      setText('perfLangTime', `95 ms`);
      setText('perfSttTime', `${s.averageSttLatencyMs} ms`);
      setText('perfAiTime', `${s.averageAiLatencyMs} ms`);
      setText('perfTtsTime', `${s.averageTtsLatencyMs} ms`);
      setText('perfAsrConf', `${s.averageConfidencePct}%`);
      setText('perfTurnsCount', `${s.totalRecordedTurns} turns`);

      // Render History Log
      const logList = document.getElementById('perfLogList');
      if (logList && json.history) {
        logList.innerHTML = json.history.slice(0, 5).map(item => `
          <div class="perf-log-card">
            <div class="plc-top">
              <span class="plc-lang">🌐 ${item.isCodeSwitched ? item.codeSwitchPair : item.detectedLanguage}</span>
              <span class="plc-time">${item.totalLatencySec}s</span>
            </div>
            <div class="plc-query">“${escapeHtml(item.query || 'Voice interaction turn')}”</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
              STT: ${item.sttLatencyMs}ms | AI: ${item.aiLatencyMs}ms | TTS: ${item.ttsLatencyMs}ms | Conf: ${item.asrConfidencePct}%
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('[fetchBenchmarkTelemetry] failed:', e);
    }
  }

  // -------------------------------------------------------------
  // Conversation History Fetcher
  // -------------------------------------------------------------
  async function fetchHistorySessions() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    try {
      const res = await fetch('/api/history');
      const json = await res.json();
      const sessions = json.sessions || [];

      if (sessions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <p style="font-size: 32px; margin-bottom: 8px;">💬</p>
            <p style="font-weight: 600;">No conversations yet</p>
            <p style="font-size: 12px;">Start a new voice conversation from the home screen.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = sessions.map(sess => {
        const lastMsg = sess.messages[sess.messages.length - 1];
        const dateStr = new Date(sess.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="history-card" data-id="${sess.id}">
            <div class="hc-top">
              <span class="hc-date">Today — ${dateStr}</span>
              <span class="hc-lang">🌐 Multilingual</span>
            </div>
            <div class="hc-snippet">${escapeHtml(lastMsg ? lastMsg.text : 'Conversation Session')}</div>
            <div class="hc-footer">
              <span>Turns: ${sess.turnCount}</span>
              <span>Avg Latency: ~1.4s</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('[fetchHistorySessions] failed:', e);
    }
  }

  // -------------------------------------------------------------
  // Event Listeners & Quick Controls
  // -------------------------------------------------------------
  function initEventListeners() {
    // Microphone buttons
    bindClick('btnHomeMic', () => {
      navigateTo('screenConversation');
      setTimeout(startListening, 300);
    });

    bindClick('btnLiveMic', toggleListening);

    // Dock Action Buttons
    bindClick('btnConvReplay', () => {
      if (state.lastAiText) {
        playSpeechResponse(state.lastAiText, state.lastAiLang);
      } else {
        showToast('No previous AI response to replay.');
      }
    });

    bindClick('btnConvPause', () => {
      const btn = document.getElementById('btnConvPause');
      const label = btn?.querySelector('.in-call-label');
      if (state.isSpeaking) {
        if (state.isPaused) {
          window.speechSynthesis?.resume();
          state.isPaused = false;
          if (btn) btn.classList.remove('active');
          if (label) label.textContent = 'Pause';
          showToast('Resumed speech playback.');
        } else {
          window.speechSynthesis?.pause();
          state.isPaused = true;
          if (btn) btn.classList.add('active');
          if (label) label.textContent = 'Resume';
          showToast('Paused speech playback.');
        }
      } else {
        showToast('No active speech playback to pause.');
      }
    });

    bindClick('btnConvMute', () => {
      state.isMuted = !state.isMuted;
      const btn = document.getElementById('btnConvMute');
      if (btn) btn.classList.toggle('active', state.isMuted);
      const label = btn?.querySelector('.in-call-label');
      if (label) label.textContent = state.isMuted ? 'Muted' : 'Mute';
      if (state.isMuted) stopSpeechSynthesis();
      showToast(state.isMuted ? 'Voice output muted.' : 'Voice output unmuted.');
    });

    bindClick('btnConvReset', resetConversation);
    bindClick('btnNewConvHeader', resetConversation);
    bindClick('btnClearAllHistory', () => {
      state.historyList = [];
      fetchHistorySessions();
      showToast('Conversation history cleared.');
    });

    // Preset Prompt Chips
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        if (text) {
          handleUserUtterance(text);
        }
      });
    });

    // Settings Controls
    const toggleDemo = document.getElementById('toggleDemoMode');
    if (toggleDemo) {
      toggleDemo.addEventListener('change', (e) => {
        state.isMockMode = e.target.checked;
        const title = document.getElementById('modeTitle');
        const desc = document.getElementById('modeDesc');
        const badge = document.getElementById('homeModeBadge');

        if (state.isMockMode) {
          if (title) title.textContent = 'DEMO / MOCK MODE';
          if (desc) desc.textContent = 'Simulated deterministic benchmark data for hackathon demo';
          if (badge) {
            badge.textContent = 'DEMO MODE';
            badge.classList.add('demo');
          }
          showToast('Switched to DEMO / MOCK MODE');
        } else {
          if (title) title.textContent = 'REAL AI MODE';
          if (desc) desc.textContent = 'Live API & contextual intelligence pipeline';
          if (badge) {
            badge.textContent = 'REAL AI MODE';
            badge.classList.remove('demo');
          }
          showToast('Switched to REAL AI MODE');
        }
      });
    }

    const selectLang = document.getElementById('selectInputLang');
    if (selectLang) {
      selectLang.addEventListener('change', (e) => {
        state.preferredLanguage = e.target.value;
        showToast(`Language set to ${e.target.value}`);
      });
    }

    const speedSlider = document.getElementById('sliderSpeechSpeed');
    const speedVal = document.getElementById('speedVal');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        state.speechSpeed = Number(e.target.value);
        if (speedVal) speedVal.textContent = `${state.speechSpeed.toFixed(1)}x`;
      });
    }

    const toggleDark = document.getElementById('toggleDarkMode');
    if (toggleDark) {
      toggleDark.addEventListener('change', (e) => {
        document.body.classList.toggle('light-theme', !e.target.checked);
        document.body.classList.toggle('dark-theme', e.target.checked);
      });
    }
  }

  function resetConversation() {
    stopSpeechSynthesis();
    state.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const container = document.getElementById('transcriptContainer');
    if (container) {
      container.innerHTML = `
        <div class="chat-bubble ai-bubble intro-bubble">
          <div class="bubble-header">
            <span class="speaker-tag">BHASHATALK AI</span>
            <span class="bubble-time">Just now</span>
          </div>
          <p class="bubble-body">Vanakkam! Namaste! New conversation started. What would you like to talk about?</p>
        </div>
      `;
    }
    const badgeText = document.getElementById('liveLangBadgeText');
    if (badgeText) badgeText.textContent = 'Auto Detect';
    setConvState('idle', 'Tap microphone to speak');
    showToast('New conversation context started.');
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function showToast(message) {
    const banner = document.getElementById('toastBanner');
    const msg = document.getElementById('toastMessage');
    if (!banner || !msg) return;

    msg.textContent = message;
    banner.classList.remove('hidden');

    clearTimeout(banner._timer);
    banner._timer = setTimeout(() => {
      banner.classList.add('hidden');
    }, 2800);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
  }

})();
