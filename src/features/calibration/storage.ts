import type {
  CalibrationProfile,
  FingerId,
  FlexSensorCalibration,
  GestureThresholdRule,
  NaturalHandPose,
} from "./types";

export const DEFAULT_SENSORS: Record<FingerId, FlexSensorCalibration> = {
  thumb: { id: "thumb", min: 180, max: 820, inverted: false },
  index: { id: "index", min: 190, max: 880, inverted: false },
  middle: { id: "middle", min: 200, max: 910, inverted: false },
  ring: { id: "ring", min: 190, max: 860, inverted: false },
  pinky: { id: "pinky", min: 170, max: 790, inverted: false },
};

export const DEFAULT_OPEN_HAND: NaturalHandPose = {
  thumb: 15,
  index: 10,
  middle: 10,
  ring: 12,
  pinky: 15,
};

export const DEFAULT_CLOSED_FIST: NaturalHandPose = {
  thumb: 88,
  index: 92,
  middle: 95,
  ring: 90,
  pinky: 86,
};

export const DEFAULT_GESTURE_RULES: Record<string, GestureThresholdRule> = {
  HELP: {
    code: "HELP",
    name: "I NEED HELP",
    tamilName: "எனக்கு உதவி தேவை",
    description: "Emergency fist: all fingers bent/curled tightly",
    tamilDescription: "அவசர மூடிய கை: அனைத்து விரல்களும் மடிக்கப்பட்டுள்ளன",
    fingers: {
      thumb: "bent",
      index: "bent",
      middle: "bent",
      ring: "bent",
      pinky: "bent",
    },
    bendThreshold: 65,
    straightThreshold: 35,
    tolerance: 20,
  },
  YES: {
    code: "YES",
    name: "YES",
    tamilName: "ஆம்",
    description: "Thumbs up: thumb straight, other four fingers bent",
    tamilDescription: "பெருவிரல் மட்டும் மேல்நோக்கி நேராக, மற்ற விரல்கள் மடிக்கப்பட்டு",
    fingers: {
      thumb: "straight",
      index: "bent",
      middle: "bent",
      ring: "bent",
      pinky: "bent",
    },
    bendThreshold: 60,
    straightThreshold: 30,
    tolerance: 20,
  },
  NO: {
    code: "NO",
    name: "NO",
    tamilName: "இல்லை",
    description: "Index straight pointing/wagging, other fingers bent",
    tamilDescription: "ஆள்காட்டி விரல் மட்டும் நேராக, மற்ற விரல்கள் மடிக்கப்பட்டு",
    fingers: {
      thumb: "bent",
      index: "straight",
      middle: "bent",
      ring: "bent",
      pinky: "bent",
    },
    bendThreshold: 60,
    straightThreshold: 30,
    tolerance: 20,
  },
  OK: {
    code: "OK",
    name: "OK",
    tamilName: "சரி",
    description: "OK sign: thumb & index curled/touching, other three straight",
    tamilDescription: "பெருவிரல் மற்றும் ஆள்காட்டி விரல் வளைந்து, மற்ற 3 விரல்கள் நேராக",
    fingers: {
      thumb: "bent",
      index: "bent",
      middle: "straight",
      ring: "straight",
      pinky: "straight",
    },
    bendThreshold: 55,
    straightThreshold: 35,
    tolerance: 20,
  },
  WATER: {
    code: "WATER",
    name: "I NEED WATER",
    tamilName: "எனக்கு தண்ணீர் வேண்டும்",
    description: "W sign: Index, middle, ring straight; thumb & pinky bent",
    tamilDescription: "ஆள்காட்டி, நடு, மோதிர விரல்கள் நேராக (W சைகை); பெருவிரல் & சிறுவிரல் மடிக்கப்பட்டு",
    fingers: {
      thumb: "bent",
      index: "straight",
      middle: "straight",
      ring: "straight",
      pinky: "bent",
    },
    bendThreshold: 60,
    straightThreshold: 35,
    tolerance: 20,
  },
  FOOD: {
    code: "FOOD",
    name: "I NEED FOOD",
    tamilName: "எனக்கு உணவு வேண்டும்",
    description: "Eating gesture: all five fingertips bent towards each other",
    tamilDescription: "உண்ணும் சைகை: 5 விரல்களும் நடுத்தர வளைவில் உள்ளங்கை நோக்கி",
    fingers: {
      thumb: "bent",
      index: "bent",
      middle: "bent",
      ring: "bent",
      pinky: "any",
    },
    bendThreshold: 50,
    straightThreshold: 30,
    tolerance: 25,
  },
  MEDICINE: {
    code: "MEDICINE",
    name: "I NEED MEDICINE",
    tamilName: "எனக்கு மருந்து வேண்டும்",
    description: "Pill pinch: thumb and index bent together, middle, ring, pinky straight",
    tamilDescription: "மாத்திரை பிடிக்கும் சைகை: பெருவிரல் & ஆள்காட்டி வளைந்து, மற்றவை நேராக",
    fingers: {
      thumb: "bent",
      index: "bent",
      middle: "straight",
      ring: "straight",
      pinky: "straight",
    },
    bendThreshold: 55,
    straightThreshold: 35,
    tolerance: 20,
  },
  CALL_ME: {
    code: "CALL_ME",
    name: "CALL ME",
    tamilName: "என்னை அழைக்கவும்",
    description: "Phone shaka: thumb & pinky extended straight, middle three bent",
    tamilDescription: "தொலைபேசி சைகை: பெருவிரல் & சிறுவிரல் நேராக, நடு மூன்று விரல்கள் மடிக்கப்பட்டு",
    fingers: {
      thumb: "straight",
      index: "bent",
      middle: "bent",
      ring: "bent",
      pinky: "straight",
    },
    bendThreshold: 60,
    straightThreshold: 30,
    tolerance: 20,
  },
  COME_HERE: {
    code: "COME_HERE",
    name: "PLEASE COME HERE",
    tamilName: "தயவுசெய்து இங்கே வாருங்கள்",
    description: "Beckoning: index bent/curling, others bent into palm",
    tamilDescription: "அழைக்கும் சைகை: ஆள்காட்டி விரல் தீவிர வளைவு, மற்றவை மடிக்கப்பட்டு",
    fingers: {
      thumb: "any",
      index: "bent",
      middle: "bent",
      ring: "bent",
      pinky: "bent",
    },
    bendThreshold: 65,
    straightThreshold: 30,
    tolerance: 25,
  },
  IM_FINE: {
    code: "IM_FINE",
    name: "I'M FINE",
    tamilName: "நான் நலமாக இருக்கிறேன்",
    description: "Open relaxed palm: all five fingers straight and resting",
    tamilDescription: "திறந்த உள்ளங்கை: ஐந்து விரல்களும் முழுமையாக நேராகவும் தளர்வாகவும்",
    fingers: {
      thumb: "straight",
      index: "straight",
      middle: "straight",
      ring: "straight",
      pinky: "straight",
    },
    bendThreshold: 60,
    straightThreshold: 35,
    tolerance: 20,
  },
};

const STORAGE_PREFIX = "voxsign_calibration_profile_";

export function loadCalibrationProfile(userId: string): CalibrationProfile {
  if (typeof window === "undefined") {
    return createDefaultProfile(userId);
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CalibrationProfile;
      return {
        ...createDefaultProfile(userId),
        ...parsed,
        sensors: { ...DEFAULT_SENSORS, ...parsed.sensors },
        gestureRules: { ...DEFAULT_GESTURE_RULES, ...parsed.gestureRules },
      };
    }
  } catch (err) {
    console.error("Failed to parse calibration profile:", err);
  }

  return createDefaultProfile(userId);
}

export function saveCalibrationProfile(profile: CalibrationProfile): void {
  if (typeof window === "undefined") return;
  try {
    const updated = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}${profile.userId}`, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save calibration profile:", err);
  }
}

export function resetCalibrationProfile(userId: string): CalibrationProfile {
  const defaults = createDefaultProfile(userId);
  saveCalibrationProfile(defaults);
  return defaults;
}

export function createDefaultProfile(userId: string): CalibrationProfile {
  return {
    userId,
    updatedAt: new Date().toISOString(),
    sensitivity: "standard",
    sensors: { ...DEFAULT_SENSORS },
    naturalOpenHand: { ...DEFAULT_OPEN_HAND },
    naturalClosedFist: { ...DEFAULT_CLOSED_FIST },
    customGesturePoses: {},
    gestureRules: { ...DEFAULT_GESTURE_RULES },
  };
}

/**
 * Generate production C++ code ready to copy-paste into the user's ESP32 Arduino sketch.
 */
export function generateArduinoCode(profile: CalibrationProfile): string {
  const sensorArray = [
    profile.sensors.thumb,
    profile.sensors.index,
    profile.sensors.middle,
    profile.sensors.ring,
    profile.sensors.pinky,
  ];

  const minList = sensorArray.map((s) => s.min).join(", ");
  const maxList = sensorArray.map((s) => s.max).join(", ");
  const invertList = sensorArray.map((s) => (s.inverted ? "true" : "false")).join(", ");

  return `// ====================================================================
// VoxSign Personalized Gesture Calibration Configuration
// Generated for User ID: ${profile.userId}
// Updated: ${new Date(profile.updatedAt).toLocaleString()}
// ====================================================================

#include <Arduino.h>

// Sensor Pin Mapping (ADC1 Pins)
const int FLEX_PINS[5] = { 36, 39, 34, 35, 32 }; // Thumb, Index, Middle, Ring, Pinky

// User Calibrated ADC Min (Open / Straight finger 0%)
const int CALIB_MIN[5] = { ${minList} };

// User Calibrated ADC Max (Closed / Bent finger 100%)
const int CALIB_MAX[5] = { ${maxList} };

// Sensor Inversion Flags
const bool CALIB_INVERT[5] = { ${invertList} };

// Read and normalize finger bend percentage (0% to 100%)
int readFingerBend(int fingerIndex) {
  int raw = analogRead(FLEX_PINS[fingerIndex]);
  int minVal = CALIB_MIN[fingerIndex];
  int maxVal = CALIB_MAX[fingerIndex];
  
  int bend = map(raw, minVal, maxVal, 0, 100);
  bend = constrain(bend, 0, 100);
  
  if (CALIB_INVERT[fingerIndex]) {
    bend = 100 - bend;
  }
  return bend;
}

// Check for emergency fist (HELP) gesture
bool isHelpGesture() {
  for (int i = 0; i < 5; i++) {
    if (readFingerBend(i) < 65) return false;
  }
  return true;
}
`;
}
