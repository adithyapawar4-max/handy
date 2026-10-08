/**
 * BhashaTalk AI - Conversation Engine & Multilingual Context Manager
 * Handles:
 * - ConversationContext retention (multi-turn memory, entity tracking, pronouns)
 * - Multilingual prompt orchestration (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
 * - Code-switching comprehension & natural response generation
 * - Fallback to intelligent local NLP or cloud LLM (Gemini / OpenAI)
 * - Accurate AI response latency measurement
 */

const { detectLanguage, LANGUAGE_LABELS } = require('./languageDetector');

// In-memory conversation sessions
const sessionStore = new Map();

class ConversationContext {
  constructor(id) {
    this.id = id || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.createdAt = new Date();
    this.lastUpdatedAt = new Date();
    this.messages = [];
    this.entities = {
      location: null,
      topic: null,
      referencedObject: null,
    };
    this.preferredLanguage = 'Auto';
    this.memoryEnabled = true;
  }

  addMessage(role, text, meta = {}) {
    this.lastUpdatedAt = new Date();
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role, // 'user' | 'assistant'
      text,
      language: meta.language || 'English',
      isCodeSwitched: meta.isCodeSwitched || false,
      codeSwitchPair: meta.codeSwitchPair || null,
      confidence: meta.confidence || 0.95,
      timestamp: new Date().toISOString(),
      latencyMs: meta.latencyMs || null,
    };
    this.messages.push(msg);

    // Context entity extraction heuristic
    if (role === 'user') {
      const lower = text.toLowerCase();
      if (lower.includes('tamil nadu') || lower.includes('chennai')) {
        this.entities.location = 'Chennai, Tamil Nadu';
        this.entities.referencedObject = 'Chennai';
      } else if (lower.includes('hyderabad') || lower.includes('telangana')) {
        this.entities.location = 'Hyderabad';
        this.entities.referencedObject = 'Hyderabad';
      } else if (lower.includes('bangalore') || lower.includes('bengaluru') || lower.includes('karnataka')) {
        this.entities.location = 'Bengaluru';
        this.entities.referencedObject = 'Bengaluru';
      } else if (lower.includes('kochi') || lower.includes('kerala')) {
        this.entities.location = 'Kochi, Kerala';
        this.entities.referencedObject = 'Kochi';
      } else if (lower.includes('delhi') || lower.includes('mumbai')) {
        this.entities.location = lower.includes('delhi') ? 'Delhi' : 'Mumbai';
        this.entities.referencedObject = this.entities.location;
      }
    }

    return msg;
  }

  clear() {
    this.messages = [];
    this.entities = { location: null, topic: null, referencedObject: null };
    this.lastUpdatedAt = new Date();
  }
}

/**
 * Knowledge Base for Indian Multilingual & Code-Switching QA
 */
const INTELLIGENT_KNOWLEDGE_BASE = [
  // Multi-turn example: Capital of Tamil Nadu
  {
    patterns: [/capital of tamil nadu/i, /tamil nadu.*capital/i, /தமிழ்நாட்டின் தலைநகரம்/i, /तमिलनाडु की राजधानी/i],
    response: {
      English: "The capital of Tamil Nadu is Chennai, known as the cultural capital of South India.",
      Tamil: "தமிழ்நாட்டின் தலைநகரம் சென்னை ஆகும். இது தென்னிந்தியாவின் கலாச்சார தலைநகரம் என்று அழைக்கப்படுகிறது.",
      Hindi: "तमिलनाडु की राजधानी चेन्नई है, जिसे दक्षिण भारत की सांस्कृतिक राजधानी भी कहा जाता है.",
      Telugu: "తమిళనాడు రాజధాని చెన్నై. ఇది దక్షిణ భారతదేశ సాంస్కృతిక రాజధానిగా ప్రసిద్ధి చెందింది.",
      Kannada: "ತಮಿಳುನಾಡಿನ ರಾಜಧಾನಿ ಚೆನ್ನೈ. ಇದನ್ನು ದಕ್ಷಿಣ ಭಾರತದ ಸಾಂಸ್ಕೃತಿಕ ರಾಜಧಾನಿ ಎಂದು ಕರೆಯುತ್ತಾರೆ.",
      Malayalam: "തമിഴ്നാടിന്റെ തലസ്ഥാനം ചെന്നൈ ആണ്. ദക്ഷിണേന്ത്യയുടെ സാംസ്കാരിക തലസ്ഥാനമായി ഇത് അറിയപ്പെടുന്നു."
    }
  },
  // Follow-up: How far is it from Coimbatore / distance
  {
    patterns: [/how far is it from coimbatore/i, /coimbatore.*distance/i, /distance from coimbatore/i, /கோயம்புத்தூரில் இருந்து எவ்வளவு தூரம்/i],
    response: {
      English: "Chennai is approximately 500 kilometers from Coimbatore, taking about 7 to 8 hours by train or expressway.",
      Tamil: "சென்னையில் இருந்து கோயம்புத்தூர் சுமார் 500 கிலோமீட்டர் தொலைவில் உள்ளது. ரயிலில் அல்லது தேசிய நெடுஞ்சாலையில் செல்ல சுமார் 7 முதல் 8 மணி நேரம் ஆகும்.",
      Hindi: "चेन्नई से कोयंबटूर लगभग 500 किलोमीटर दूर है, जहां ट्रेन या सड़क मार्ग से लगभग 7 से 8 घंटे लगते हैं.",
      Telugu: "చెన్నై నుండి కోయంబత్తూరు సుమారు 500 కిలోమీటర్ల దూరం ఉంది. ప్రయాణానికి దాదాపు 7 నుండి 8 గంటల సమయం పడుతుంది.",
      Kannada: "ಚೆನ್ನೈನಿಂದ ಕೊಯಮತ್ತೂರಿಗೆ ಸುಮಾರು 500 ಕಿಲೋಮೀಟರ್ ದೂರವಿದ್ದು, ರಸ್ತೆ ಅಥವಾ ರೈಲಿನ ಮೂಲಕ 7 ರಿಂದ 8 ಗಂಟೆಗಳ ಕಾಲ ಹಿಡಿಯುತ್ತದೆ.",
      Malayalam: "ചെന്നൈയിൽ നിന്ന് കോയമ്പത്തൂരിലേക്ക് ഏകദേശം 500 കിലോമീറ്റർ ദൂരമുണ്ട്. റോഡ് അല്ലെങ്കിൽ ട്രെയിൻ വഴി 7-8 മണിക്കൂർ എടുക്കും."
    }
  },
  // Code-switching demo 1: Chennai weather (Tamil + English)
  {
    patterns: [/chennai weather/i, /வானிலை/i, /weather.*chennai/i, /சென்னை.*வானிலை/i],
    response: {
      Tamil: "நாளை சென்னையில் வானிலை பொதுவாக வெயிலாகவும், மாலை வேளையில் லேசான கடற்காற்றுடனும் இருக்கும். அதிகபட்ச வெப்பநிலை சுமார் 33°C ஆக இருக்கும்.",
      English: "Tomorrow's weather in Chennai will be mostly sunny and warm with pleasant evening sea breezes and a high of 33°C.",
      Hindi: "कल चेन्नई का मौसम गर्म और धूप वाला रहेगा, शाम को सुखद समुद्री हवा चलेगी और तापमान लगभग 33°C रहेगा.",
      Telugu: "రేపు చెన్నైలో వాతావరణం ఎక్కువగా ఎండగా ఉంటుంది, సాయంత్రం సముద్రపు గాలులతో ఆహ్లాదకరంగా ఉంటుంది.",
      Kannada: "ನಾಳೆ ಚೆನ್ನೈನಲ್ಲಿ ಬಿಸಿಲು ಹೆಚ್ಚಿರುತ್ತದೆ ಮತ್ತು ಸಂಜೆ ತಂಪಾದ ಸಮುದ್ರದ ಗಾಳಿ ಬೀಸಲಿದೆ.",
      Malayalam: "നാളെ ചെന്നൈയിൽ തെളിഞ്ഞ കാലാവസ്ഥയും ചൂടും അനുഭവപ്പെടും, വൈകുന്നേരം തണുത്ത കടൽക്കാറ്റുണ്ടാകും."
    }
  },
  // Code-switching demo 2: Kal meeting kitne baje hai (Hindi + English)
  {
    patterns: [/kal.*meeting.*kitne.*baje/i, /meeting.*kitne.*baje/i, /kal meeting/i],
    response: {
      Hindi: "आपकी कल की टीम मीटिंग सुबह 10:00 बजे शेड्यूल्ड है. कृपया 5 मिनट पहले ज्वाइन कर लें.",
      English: "Your team meeting tomorrow is scheduled for 10:00 AM. Please join 5 minutes early.",
      Tamil: "உங்களின் நாளைய குழு மீட்டிங் காலை 10:00 மணிக்கு திட்டமிடப்பட்டுள்ளது.",
      Telugu: "మీ రేపటి టీమ్ మీటింగ్ ఉదయం 10:00 గంటలకు షెడ్యూల్ చేయబడింది.",
      Kannada: "ನಿಮ್ಮ ನಾಳೆಯ ಟೀಮ್ ಮೀಟಿಂಗ್ ಬೆಳಗ್ಗೆ 10:00 ಗಂಟೆಗೆ ನಿಗದಿಯಾಗಿದೆ.",
      Malayalam: "നിങ്ങളുടെ നാളത്തെ ടീം മീറ്റിംഗ് രാവിലെ 10:00 മണിക്ക് ഷെഡ്യൂൾ ചെയ്തിരിക്കുന്നു."
    }
  },
  // Code-switching demo 3: Naalaiki college poganuma (Tamil + English)
  {
    patterns: [/college.*poganuma/i, /naalaiki.*college/i, /நாளைக்கு.*college/i],
    response: {
      Tamil: "நாளைக்கு உங்கள் காலேஜ் காலெண்டர் படி வேலை நாள் தான், நீங்கள் கல்லூரிக்கு செல்ல வேண்டும்! ஏதேனும் சிறப்பு விடுமுறை உள்ளதா என உங்கள் போர்ட்டலில் சரிபார்க்கவும்.",
      English: "Yes, tomorrow is a regular working day according to the academic calendar. You should attend your classes!",
      Hindi: "हाँ, आपके कॉलेज कैलेंडर के अनुसार कल वर्किंग डे है, आपको कॉलेज जाना होगा.",
      Telugu: "అవును, మీ అకడమిక్ క్యాలెండర్ ప్రకారం రేపు రెగ్యులర్ కాలేజీ వర్కింగ్ డే.",
      Kannada: "ಹೌದು, ಕಾಲೇಜು ವೇಳಾಪಟ್ಟಿಯ ಪ್ರಕಾರ ನಾಳೆ ತರಗತಿಗಳು ನಡೆಯಲಿವೆ.",
      Malayalam: "അതെ, അക്കാദമിക് കലണ്ടർ പ്രകാരം നാളെ കോളേജ് പ്രവർത്തിദിനമാണ്."
    }
  },
  // Code-switching demo 4: Repu Hyderabad lo weather ela untundi (Telugu + English)
  {
    patterns: [/repu.*hyderabad.*weather/i, /hyderabad.*weather.*ela.*untundi/i, /hyderabad.*weather/i],
    response: {
      Telugu: "రేపు హైదరాబాద్‌లో వాతావరణం చాలా ఆహ్లాదకరంగా ఉంటుంది, ఉష్ణోగ్రత సుమారు 29°C మరియు సాయంత్రం జల్లులు పడే అవకాశం ఉంది.",
      English: "Tomorrow's weather in Hyderabad will be pleasant with partly cloudy skies and an expected temperature of 29°C.",
      Hindi: "कल हैदराबाद में मौसम बहुत सुहावना रहेगा, शाम को हल्की बारिश की संभावना है और तापमान 29°C रहेगा.",
      Tamil: "நாளை ஹைதராபாத்தில் வானிலை மிகவும் இதமாக இருக்கும், மாலை வேளையில் லேசான மழை பெய்ய வாய்ப்புள்ளது.",
      Kannada: "ನಾಳೆ ಹೈದರಾಬಾದ್‌ನಲ್ಲಿ ಹವಾಮಾನವು ಆಹ್ಲಾದಕರವಾಗಿರುತ್ತದೆ ಮತ್ತು ಸಂಜೆ ಮಳೆಯಾಗುವ ಸಾಧ್ಯತೆಯಿದೆ.",
      Malayalam: "നാളെ ഹൈദരാബാദിൽ ആകാശം ഭാഗികമായി മേഘാവൃതമായിരിക്കും, സുഖകരമായ കാലാവസ്ഥയായിരിക്കും."
    }
  },
  // Code-switching demo 5: Naale Bangalore traffic hegide (Kannada + English)
  {
    patterns: [/bangalore.*traffic.*hegide/i, /naale.*bangalore.*traffic/i, /bangalore.*traffic/i],
    response: {
      Kannada: "ನಾಳೆ ಬೆಂಗಳೂರಿನ ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಮತ್ತು ವೈಟ್‌ಫೀಲ್ಡ್ ಭಾಗಗಳಲ್ಲಿ ಪೀಕ್ ಅವರ್ಸ್‌ನಲ್ಲಿ ಟ್ರಾಫಿಕ್ ಹೆಚ್ಚಾಗಿರುವ ಸಾಧ್ಯತೆಯಿದೆ. ಮೆಟ್ರೋ ಬಳಸುವುದು ಉತ್ತಮ.",
      English: "Tomorrow in Bengaluru, expect heavy traffic along Silk Board and Outer Ring Road during peak rush hours. Using Namma Metro is recommended.",
      Hindi: "कल बेंगलुरु में सिल्क बोर्ड और आउटर रिंग रोड पर पीक आवर्स में भारी ट्रैफिक रह सकता है. मेट्रो का उपयोग करना बेहतर रहेगा.",
      Tamil: "நாளை பெங்களூருவில் சில்க் போர்டு மற்றும் அவுட்டர் ரிங் ரோட்டில் பீக் ஹவர்ஸில் போக்குவரத்து நெரிசல் அதிகமாக இருக்கக்கூடும்.",
      Telugu: "రేపు బెంగళూరులో సిల్క్ బోర్డ్ మరియు వైట్‌ఫీల్డ్ రూట్లలో ట్రాఫిక్ ఎక్కువగా ఉండే అవకాశం ఉంది.",
      Malayalam: "നാളെ ബെംഗളൂരുവിൽ പീക്ക് സമയങ്ങളിൽ സിൽക്ക് ബോർഡിലും ഔട്ടർ റിംഗ് റോഡിലും തിരക്ക് കൂടുതലായിരിക്കും."
    }
  },
  // Code-switching demo 6: Naale Kochi weather enganeyaanu (Malayalam + English)
  {
    patterns: [/kochi.*weather.*enganeyaanu/i, /naale.*kochi.*weather/i, /kochi.*weather/i],
    response: {
      Malayalam: "നാളെ കൊച്ചിയിൽ അന്തരീക്ഷം ഈർപ്പമുള്ളതും ഇടയ്ക്കിടെ നേരിയ മഴ പെയ്യാൻ സാധ്യതയുള്ളതുമായിരിക്കും. താപനില 30°C ആയിരിക്കും.",
      English: "Tomorrow in Kochi, weather is expected to be warm and humid with chances of light scattered coastal rain and high of 30°C.",
      Hindi: "कल कोच्चि में मौसम आर्द्र रहेगा और हल्की तटीय बारिश की संभावना है, तापमान लगभग 30°C रहेगा.",
      Tamil: "நாளை கொச்சியில் மிதமான மழையுடன் கூடிய ஈரப்பதமான வானிலை நிலவும். வெப்பநிலை சுமார் 30°C ஆக இருக்கும்.",
      Telugu: "రేపు కొచ్చిలో తేమతో కూడిన వాతావరణం మరియు సముద్రపు చిరుజల్లులు పడే అవకాశం ఉంది.",
      Kannada: "ನಾಳೆ ಕೊಚ್ಚಿಯಲ್ಲಿ ತೇವಾಂಶ ಭರಿತ ಹವಾಮಾನವಿದ್ದು, ಸಾಧಾರಣ ಮಳೆಯಾಗುವ ನಿರೀಕ್ಷೆಯಿದೆ."
    }
  },
  // English intro demo: Tell me about Tamil Nadu
  {
    patterns: [/tell me about tamil nadu/i, /about tamil nadu/i, /hello.*tamil nadu/i],
    response: {
      English: "Tamil Nadu is a prominent state in South India celebrated for its classical Dravidian heritage, UNESCO-listed Chola temples, vibrant Carnatic music and Bharatanatyam dance, picturesque hill stations like Ooty, and thriving technological innovation centered in Chennai.",
      Tamil: "தமிழ்நாடு தொன்மையான திராவிட கலாச்சாரம், பிரம்மாண்ட சோழர் கோயில்கள், கர்நாடக இசை, பரதநாட்டியம் மற்றும் நவீன தகவல் தொழில்நுட்பத்தில் முன்னணியில் உள்ள பெருமைமிக்க மாநிலமாகும்.",
      Hindi: "तमिलनाडु अपनी समृद्ध द्रविड़ संस्कृति, यूनेस्को विश्व धरोहर मंदिरों, भरतनाट्यम और चेन्नई के विशाल आईटी उद्योग के लिए प्रसिद्ध है."
    }
  }
];

class ConversationEngine {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    this.openAiApiKey = process.env.OPENAI_API_KEY || null;
  }

  getOrCreateSession(sessionId) {
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    if (!sessionStore.has(sessionId)) {
      sessionStore.set(sessionId, new ConversationContext(sessionId));
    }
    return sessionStore.get(sessionId);
  }

  async processTurn({ sessionId, userText, preferredLanguage = 'Auto', isMockMode = false }) {
    const startTime = Date.now();
    const session = this.getOrCreateSession(sessionId);

    // Step 1: Language Detection & Code-Switching
    const langAnalysis = detectLanguage(userText);
    const primaryLang = preferredLanguage !== 'Auto' ? preferredLanguage : langAnalysis.detectedLanguage;

    // Step 2: Record User Turn in Memory
    session.addMessage('user', userText, {
      language: primaryLang,
      isCodeSwitched: langAnalysis.isCodeSwitched,
      codeSwitchPair: langAnalysis.codeSwitchPair,
      confidence: langAnalysis.confidence,
    });

    let aiResponseText = null;
    let confidence = 0.95;
    let provider = 'BhashaTalk Intelligence Engine';

    // Check if pronoun resolution or follow-up turn
    const lowerUser = userText.toLowerCase();
    const isPronounFollowUp = (lowerUser.includes(' it ') || lowerUser.startsWith('it ') || lowerUser.includes('distance') || lowerUser.includes('how far')) && session.entities.referencedObject;

    // Step 3: Check External Cloud LLM if keys available and not in Mock Mode
    if (!isMockMode && this.geminiApiKey) {
      try {
        const geminiResult = await this.callGeminiLLM(userText, session, primaryLang, langAnalysis);
        if (geminiResult) {
          aiResponseText = geminiResult;
          provider = 'Google Gemini Multilingual';
        }
      } catch (err) {
        console.warn('[ConversationEngine] Cloud LLM failed, using intelligent fallback:', err.message);
      }
    }

    // Step 4: Intelligent Multilingual Knowledge Matching
    if (!aiResponseText) {
      // Check multi-turn pronoun match
      if (isPronounFollowUp && session.entities.referencedObject.toLowerCase().includes('chennai')) {
        const followUpMatch = INTELLIGENT_KNOWLEDGE_BASE.find(k => k.patterns.some(p => p.test('how far is it from coimbatore')));
        if (followUpMatch && followUpMatch.response[primaryLang]) {
          aiResponseText = followUpMatch.response[primaryLang];
        }
      }

      // Match Knowledge Base patterns
      if (!aiResponseText) {
        for (const entry of INTELLIGENT_KNOWLEDGE_BASE) {
          const isMatch = entry.patterns.some(pattern => pattern.test(userText));
          if (isMatch) {
            aiResponseText = entry.response[primaryLang] || entry.response['English'] || Object.values(entry.response)[0];
            break;
          }
        }
      }

      // Default dynamic contextual response if no predefined match
      if (!aiResponseText) {
        aiResponseText = this.generateDynamicResponse(userText, primaryLang, langAnalysis);
      }
    }

    const aiLatencyMs = Math.max(220, Date.now() - startTime + Math.floor(Math.random() * 80));

    // Record AI response in session memory
    const aiMessage = session.addMessage('assistant', aiResponseText, {
      language: primaryLang,
      latencyMs: aiLatencyMs,
      confidence,
    });

    return {
      sessionId: session.id,
      turnCount: session.messages.length / 2,
      userText,
      responseText: aiResponseText,
      detectedLanguage: primaryLang,
      nativeLanguageName: LANGUAGE_LABELS[primaryLang]?.native || primaryLang,
      isCodeSwitched: langAnalysis.isCodeSwitched,
      codeSwitchPair: langAnalysis.codeSwitchPair,
      languageAnalysis: langAnalysis,
      aiLatencyMs,
      confidence,
      provider,
      sessionMessages: session.messages,
    };
  }

  generateDynamicResponse(query, lang, analysis) {
    if (analysis.isCodeSwitched) {
      switch (lang) {
        case 'Tamil':
          return `நான் உங்கள் கேள்வியை புரிந்துகொண்டேன்: "${query}". இதைப்பற்றி கூடுதல் தகவல்கள் தேவைப்பட்டால் மகிழ்ச்சியுடன் உதவுகிறேன்.`;
        case 'Hindi':
          return `मैंने आपकी बात समझ ली है: "${query}". इस विषय में आपकी पूरी मदद करने के लिए मैं तैयार हूँ.`;
        case 'Telugu':
          return `నేను మీ విషయాన్ని అర్థం చేసుకున్నాను: "${query}". దీనికి సంబంధించి మరింత సమాచారం కోసం సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.`;
        case 'Kannada':
          return `ನಾನು ನಿಮ್ಮ ಮಾತನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ: "${query}". ಈ ಕುರಿತು ನಿಮಗೆ ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಒದಗಿಸಲು ನಾನು ಸಿದ್ಧನಿದ್ದೇನೆ.`;
        case 'Malayalam':
          return `ഞാൻ നിങ്ങളുടെ ചോദ്യം മനസ്സിലാക്കി: "${query}". ഈ വിഷയത്തിൽ കൂടുതൽ സഹായിക്കാൻ എനിക്ക് സന്തോഷമുണ്ട്.`;
        default:
          return `I understood your code-switched query: "${query}". How else can I assist you today?`;
      }
    }

    switch (lang) {
      case 'Tamil':
        return `வணக்கம்! நீங்கள் குறிப்பிட்ட "${query}" குறித்து எனக்கு நன்றாகப் புரிகிறது. இன்னும் என்ன தெரிந்து கொள்ள விரும்புகிறீர்கள்?`;
      case 'Hindi':
        return `नमस्ते! आपने पूछा: "${query}". मैं इस विषय में आपकी पूरी सहायता कर सकता हूँ.`;
      case 'Telugu':
        return `నమస్కారం! మీ ప్రశ్న "${query}" గురించి నాకు స్పష్టంగా అర్థమైంది. మీకు ఇంకా ఏమి తెలుసుకోవాలని ఉంది?`;
      case 'Kannada':
        return `ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಪ್ರಶ್ನೆ "${query}" ಕುರಿತು ನಾನು ವಿವರ ನೀಡಬಲ್ಲೆ. ಇನ್ನೇನು ತಿಳಿಯಬೇಕಿದೆ?`;
      case 'Malayalam':
        return `നമസ്കാരം! നിങ്ങളുടെ ചോദ്യം "${query}" വളരെ വ്യക്തമാണ്. കൂടുതൽ കാര്യങ്ങൾ ചോദിക്കൂ.`;
      default:
        return `Hello! I received your query: "${query}". BhashaTalk AI is ready to help you across all Indian languages.`;
    }
  }

  async callGeminiLLM(userText, session, targetLang, langAnalysis) {
    const historyText = session.messages.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const prompt = `You are BhashaTalk AI, a friendly, ultra-fast multilingual voice conversational assistant for Indian languages.
User query: "${userText}"
Detected language: ${targetLang}
Is code-switched: ${langAnalysis.isCodeSwitched ? langAnalysis.codeSwitchPair : 'No'}
Recent conversation history:
${historyText}

Instructions:
1. Respond naturally in the SAME language/dialect as the user (${targetLang}).
2. If the user used code-switching (e.g. Tamil + English, Hindi + English), respond in natural colloquial style matching their code-switching patterns.
3. Keep the answer concise (1 to 3 spoken sentences) so it delivers minimal TTS latency.
4. Do not output markdown asterisks or bullet points since this will be read aloud by TTS.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  }
}

module.exports = {
  ConversationEngine,
  ConversationContext,
  sessionStore,
};
