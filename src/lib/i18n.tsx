import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "ta";

export const translations = {
  en: {
    // Navigation
    nav_dashboard: "Dashboard",
    nav_messages: "Messages",
    nav_gestures: "Gestures",
    nav_history: "History",
    nav_profile: "Profile",
    nav_requests: "Requests",
    nav_sign_out: "Sign out",
    sender_console: "sender console",
    receiver_console: "receiver console",
    unnamed_user: "Unnamed user",

    // Profile Page
    profile_title: "Profile",
    profile_subtitle: "Account and hardware settings",
    language_title: "Language / மொழி",
    language_subtitle: "Choose your preferred application language (English or தமிழ்)",
    english_label: "English",
    tamil_label: "தமிழ் (Tamil)",
    account_title: "Account",
    full_name: "Full name",
    role: "Role",
    save_changes: "Save changes",
    profile_updated: "Profile updated",
    user_id_copied: "User ID copied",
    sender_account: "sender account",
    receiver_account: "receiver account",

    // ESP32 Devices
    esp32_devices: "ESP32 devices",
    new_device_key: "New device key",
    device_desc:
      "Each device gets a private key. The glove sends it in the x-device-key header — never put backend admin keys in firmware or frontend code.",
    no_devices: "No devices paired yet.",
    device_key_copied: "Device key copied",
    device_key_created: "Device key created",
    hardware_endpoint: "Hardware endpoint",

    // Lifecycle
    status_sent: "Sent",
    status_delivered: "Delivered",
    status_seen: "Seen",
    status_help_provided: "Help Provided",

    // Gestures
    gesture_help: "I NEED HELP",
    gesture_assistance: "NEED ASSISTANCE",
    gesture_water: "WATER",
    gesture_medicine: "MEDICINE",
    gesture_emergency: "EMERGENCY",
    gesture_thank_you: "THANK YOU",

    // Messages & Private Chat
    messages_title: "Messages",
    messages_subtitle: "Private chat with your linked caregivers",
    request_updates: "Request updates",
    request_seen: "Your request has been seen.",
    help_coming: "A receiver is coming to help you.",
    no_linked_senders: "No linked senders yet. Accept a caregiver invitation to start a private chat.",
    private_chat_unlocks: "Private chat unlocks once a trusted caregiver accepts your link request.",
    view_caregiver_invitations: "View caregiver invitations",
    add_trusted_caregiver: "Add a trusted caregiver",
    linked_senders: "Linked senders",
    trusted_caregivers: "Trusted caregivers",
    primary_badge: "Primary",
    chat_private: "Private",
    chat_read: "Read",
    chat_speak: "Speak",
    no_messages_yet: "No messages yet. Say hello — only the two of you can read this chat.",
    voice_message: "Voice message",
    write_private_message: "Write a private message…",
    send_photo_video: "Send a photo or video",
    record_voice: "Record a voice message",
    stop_send_voice: "Stop and send voice message",
    choose_photo_video: "Please choose a photo or a video.",
    file_too_large: "File is too large (max 50 MB).",
    mic_permission_needed: "Microphone permission is needed to record a voice message.",
    message_from: "Message from",
    quick_replies: "Quick messages",
    msg_hello: "Hello!",
    msg_how_are_you: "How are you?",
    msg_need_help: "I need help",
    msg_thank_you: "Thank you!",
    msg_coming: "I am on my way to help you.",
    msg_all_good: "Everything is okay.",

    // Dashboard & Gestures UI
    demo_gestures: "Demo gestures",
    demo_gestures_desc: "Simulate the gestures the ESP32 glove will recognise.",
    emergency_gesture: "Emergency gesture",
    tap_to_alert: "Tap to alert receivers",
    emergency_desc: "Your request reaches every receiver instantly and updates live as they respond.",
    gesture_event_log: "Gesture event log",
    gesture_event_log_desc: "Every recognised gesture, including readings sent by the ESP32 glove.",
    translator_live: "Sign language translator · live",
    waiting_gesture: "Waiting for a gesture from your glove… recognized signs will appear here and speak aloud.",
    speak_again: "Speak again",
    recent_history: "Recent history",
    view_all: "View all",
    mark_as_seen: "Mark as seen",
    i_will_help: "I will help",
    total_requests: "Total requests",
    awaiting_help: "Awaiting help",
    help_provided_count: "Help provided",
    latest_request_status: "Latest request status",
    nothing_here: "Nothing here yet.",
    no_requests_yet: "No requests yet. Press the button to send your first one.",
    gesture_sent_toast: "sent",
  },
  ta: {
    // Navigation
    nav_dashboard: "முகப்பு",
    nav_messages: "செய்திகள்",
    nav_gestures: "சைகைகள்",
    nav_history: "வரலாறு",
    nav_profile: "சுயவிவரம்",
    nav_requests: "கோரிக்கைகள்",
    nav_sign_out: "வெளியேறு",
    sender_console: "அனுப்புநர் கன்சோல்",
    receiver_console: "பெறுநர் கன்சோல்",
    unnamed_user: "பெயரிடப்படாத பயனர்",

    // Profile Page
    profile_title: "சுயவிவரம்",
    profile_subtitle: "கணக்கு மற்றும் சாதன அமைப்புகள்",
    language_title: "மொழி விருப்பம் (Language)",
    language_subtitle: "உங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும் (English அல்லது தமிழ்)",
    english_label: "English (ஆங்கிலம்)",
    tamil_label: "தமிழ் (Tamil)",
    account_title: "கணக்கு விவரங்கள்",
    full_name: "முழு பெயர்",
    role: "பங்கு (Role)",
    save_changes: "மாற்றங்களைச் சேமி",
    profile_updated: "சுயவிவரம் புதுப்பிக்கப்பட்டது",
    user_id_copied: "பயனர் ஐடி நகலெடுக்கப்பட்டது",
    sender_account: "அனுப்புநர் கணக்கு",
    receiver_account: "பெறுநர் கணக்கு",

    // ESP32 Devices
    esp32_devices: "ESP32 சாதனங்கள்",
    new_device_key: "புதிய சாதன சாவி",
    device_desc:
      "ஒவ்வொரு சாதனத்திற்கும் ஒரு தனிப்பட்ட சாவி வழங்கப்படுகிறது. கையுறை அதை x-device-key தலைப்பில் அனுப்புகிறது — நிர்வாக சாவிகளை ஃபார்ம்வேரில் பகிர வேண்டாம்.",
    no_devices: "சாதனங்கள் இன்னும் இணைக்கப்படவில்லை.",
    device_key_copied: "சாதன சாவி நகலெடுக்கப்பட்டது",
    device_key_created: "சாதன சாவி உருவாக்கப்பட்டது",
    hardware_endpoint: "வன்பொருள் முனை (Hardware endpoint)",

    // Lifecycle
    status_sent: "அனுப்பப்பட்டது",
    status_delivered: "டெலிவரி செய்யப்பட்டது",
    status_seen: "பார்க்கப்பட்டது",
    status_help_provided: "உதவி வழங்கப்பட்டது",

    // Gestures
    gesture_help: "எனக்கு உதவி தேவை",
    gesture_assistance: "உதவி தேவை",
    gesture_water: "தண்ணீர்",
    gesture_medicine: "மருந்து",
    gesture_emergency: "அவசரம்",
    gesture_thank_you: "நன்றி",

    // Messages & Private Chat
    messages_title: "செய்திகள்",
    messages_subtitle: "உங்கள் பராமரிப்பாளர்களுடனான தனிப்பட்ட அரட்டை",
    request_updates: "கோரிக்கை அறிவிப்புகள்",
    request_seen: "உங்கள் கோரிக்கை பார்க்கப்பட்டது.",
    help_coming: "உங்களுக்கு உதவ ஒருவர் வருகிறார்.",
    no_linked_senders: "இணைக்கப்பட்ட அனுப்புநர்கள் இன்னும் இல்லை. தனிப்பட்ட அரட்டையைத் தொடங்க பராமரிப்பாளர் அழைப்பை ஏற்கவும்.",
    private_chat_unlocks: "நம்பகமான பராமரிப்பாளர் உங்கள் கோரிக்கையை ஏற்றதும் தனிப்பட்ட அரட்டை திறக்கப்படும்.",
    view_caregiver_invitations: "பராமரிப்பாளர் அழைப்புகளைக் காண்க",
    add_trusted_caregiver: "நம்பகமான பராமரிப்பாளரைச் சேர்க்கவும்",
    linked_senders: "இணைக்கப்பட்ட அனுப்புநர்கள்",
    trusted_caregivers: "நம்பகமான பராமரிப்பாளர்கள்",
    primary_badge: "முதன்மையானவர்",
    chat_private: "தனிப்பட்டது",
    chat_read: "படிக்கப்பட்டது",
    chat_speak: "ஒலி மூலம் கேள்",
    no_messages_yet: "செய்திகள் எதுவும் இல்லை. வணக்கம் கூறுங்கள் — நீங்கள் இருவர் மட்டுமே இதைப் பார்க்க முடியும்.",
    voice_message: "குரல் செய்தி",
    write_private_message: "தனிப்பட்ட செய்தியை எழுதவும்…",
    send_photo_video: "புகைப்படம் அல்லது வீடியோ அனுப்பவும்",
    record_voice: "குரல் செய்தியைப் பதிவு செய்யவும்",
    stop_send_voice: "பதிவை நிறுத்தி அனுப்பவும்",
    choose_photo_video: "புகைப்படம் அல்லது வீடியோவைத் தேர்ந்தெடுக்கவும்.",
    file_too_large: "கோப்பு மிகவும் பெரியது (அதிகபட்சம் 50 MB).",
    mic_permission_needed: "குரல் செய்தியைப் பதிவு செய்ய மைக்ரோஃபோன் அனுமதி தேவை.",
    message_from: "அனுப்பியவர்",
    quick_replies: "விரைவு செய்திகள்",
    msg_hello: "வணக்கம்!",
    msg_how_are_you: "எப்படி இருக்கிறீர்கள்?",
    msg_need_help: "எனக்கு உதவி தேவை",
    msg_thank_you: "நன்றி!",
    msg_coming: "உங்களுக்கு உதவ நான் வருகிறேன்.",
    msg_all_good: "எல்லாம் நலமாக உள்ளது.",

    // Dashboard & Gestures UI
    demo_gestures: "மாதிரி சைகைகள்",
    demo_gestures_desc: "ESP32 கையுறை அங்கீகரிக்கும் சைகைகளை சோதிக்கவும்.",
    emergency_gesture: "அவசர சைகை",
    tap_to_alert: "பெறுநர்களுக்கு அறிவிக்க தட்டவும்",
    emergency_desc: "உங்கள் கோரிக்கை ஒவ்வொரு பெறுநரையும் உடனடியாக சென்றடையும், அவர்கள் பதிலளிக்கும் போது நேரலையாக புதுப்பிக்கப்படும்.",
    gesture_event_log: "சைகை நிகழ்வுப் பதிவு",
    gesture_event_log_desc: "ESP32 கையுறை அனுப்பிய வாசிப்புகள் உட்பட அங்கீகரிக்கப்பட்ட ஒவ்வொரு சைகையும்.",
    translator_live: "சைகை மொழி மொழிபெயர்ப்பாளர் · நேரலை",
    waiting_gesture: "உங்கள் கையுறையிலிருந்து சைகைக்காகக் காத்திருக்கிறது… அங்கீகரிக்கப்பட்ட சைகைகள் இங்கே தோன்றி குரலில் ஒலிக்கும்.",
    speak_again: "மீண்டும் பேசு",
    recent_history: "சமீபத்திய வரலாறு",
    view_all: "அனைத்தையும் காண்க",
    mark_as_seen: "பார்த்ததாகக் குறிக்கவும்",
    i_will_help: "நான் உதவுகிறேன்",
    total_requests: "மொத்த கோரிக்கைகள்",
    awaiting_help: "உதவிக்காக காத்திருக்கிறது",
    help_provided_count: "உதவி வழங்கப்பட்டது",
    latest_request_status: "சமீபத்திய கோரிக்கை நிலை",
    nothing_here: "இன்னும் எதுவும் இல்லை.",
    no_requests_yet: "கோரிக்கைகள் எதுவும் இல்லை. உங்கள் முதல் கோரிக்கையை அனுப்ப பொத்தானை அழுத்தவும்.",
    gesture_sent_toast: "அனுப்பப்பட்டது",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.en[key] ?? key,
});

const STORAGE_KEY = "voxsign_preferred_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "en" || saved === "ta") {
        setLanguageState(saved);
      }
    } catch {
      // ignore in environments without localStorage
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export interface LocalizedGesture {
  code: string;
  message: string;
  description: string;
  tone: "emergency" | "waiting" | "success";
}

export function getLocalizedGestures(lang: Language): LocalizedGesture[] {
  return [
    {
      code: "HELP",
      message: lang === "ta" ? "எனக்கு உதவி தேவை" : "I NEED HELP",
      description:
        lang === "ta"
          ? "உடனடி அவசர உதவி தேவைப்படுகிறது."
          : "Emergency assistance required right now.",
      tone: "emergency",
    },
    {
      code: "YES",
      message: lang === "ta" ? "ஆம்" : "YES",
      description:
        lang === "ta"
          ? "பராமரிப்பாளரின் கேள்விக்கு ஆம் என பதிலளிக்கவும்."
          : "Answer yes to a question from your caregiver.",
      tone: "success",
    },
    {
      code: "NO",
      message: lang === "ta" ? "இல்லை" : "NO",
      description:
        lang === "ta"
          ? "பராமரிப்பாளரின் கேள்விக்கு இல்லை என பதிலளிக்கவும்."
          : "Answer no to a question from your caregiver.",
      tone: "emergency",
    },
    {
      code: "OK",
      message: lang === "ta" ? "சரி" : "OK",
      description:
        lang === "ta"
          ? "எல்லாம் சரியாக உள்ளது என்று தெரிவிக்கவும்."
          : "Let your caregiver know everything is fine.",
      tone: "success",
    },
    {
      code: "WATER",
      message: lang === "ta" ? "எனக்கு தண்ணீர் வேண்டும்" : "I NEED WATER",
      description:
        lang === "ta" ? "ஒரு டம்ளர் தண்ணீர் கேட்கவும்." : "Ask for a glass of water.",
      tone: "waiting",
    },
    {
      code: "FOOD",
      message: lang === "ta" ? "எனக்கு உணவு வேண்டும்" : "I NEED FOOD",
      description:
        lang === "ta"
          ? "பசி எடுப்பதாக பராமரிப்பாளருக்குத் தெரிவிக்கவும்."
          : "Let your caregiver know you are hungry.",
      tone: "waiting",
    },
    {
      code: "MEDICINE",
      message: lang === "ta" ? "எனக்கு மருந்து வேண்டும்" : "I NEED MEDICINE",
      description:
        lang === "ta"
          ? "உங்கள் மருந்து அல்லது மாத்திரைகளைக் கேட்கவும்."
          : "Request your medicine or tablets.",
      tone: "emergency",
    },
    {
      code: "CALL_ME",
      message: lang === "ta" ? "என்னை அழைக்கவும்" : "CALL ME",
      description:
        lang === "ta"
          ? "உங்களை அழைக்குமாறு பராமரிப்பாளரிடம் கேட்கவும்."
          : "Ask your caregiver to call you.",
      tone: "waiting",
    },
    {
      code: "COME_HERE",
      message: lang === "ta" ? "தயவுசெய்து இங்கே வாருங்கள்" : "PLEASE COME HERE",
      description:
        lang === "ta"
          ? "பராமரிப்பாளரை உங்கள் அருகில் வருமாறு கேட்கவும்."
          : "Ask your caregiver to come to you.",
      tone: "waiting",
    },
    {
      code: "IM_FINE",
      message: lang === "ta" ? "நான் நலமாக இருக்கிறேன்" : "I'M FINE",
      description:
        lang === "ta"
          ? "நீங்கள் நலமாக இருப்பதாக உறுதியளிக்கவும்."
          : "Reassure your caregiver that you are okay.",
      tone: "success",
    },
  ];
}

export function translateGestureMessage(
  code: string | undefined,
  originalMessage: string | undefined,
  lang: Language,
): string {
  if (!code && !originalMessage) return "";
  if (lang !== "ta") return originalMessage || code || "";
  const match = getLocalizedGestures("ta").find((g) => g.code === code);
  return match?.message || originalMessage || code || "";
}

