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
