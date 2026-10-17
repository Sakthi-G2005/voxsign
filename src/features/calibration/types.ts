export type FingerId = "thumb" | "index" | "middle" | "ring" | "pinky";

export type FingerRequirement = "bent" | "straight" | "any";

export interface FingerInfo {
  id: FingerId;
  name: string;
  tamilName: string;
  sensorKey: string; // e.g. "flex1"
  gpioPin: string; // e.g. "GPIO 36 (ADC1_CH0)"
}

export const FINGERS: FingerInfo[] = [
  { id: "thumb", name: "Thumb", tamilName: "பெருவிரல்", sensorKey: "flex1", gpioPin: "GPIO 36 (ADC1_CH0)" },
  { id: "index", name: "Index", tamilName: "ஆள்காட்டி விரல்", sensorKey: "flex2", gpioPin: "GPIO 39 (ADC1_CH3)" },
  { id: "middle", name: "Middle", tamilName: "நடுவிரல்", sensorKey: "flex3", gpioPin: "GPIO 34 (ADC1_CH6)" },
  { id: "ring", name: "Ring", tamilName: "மோதிர விரல்", sensorKey: "flex4", gpioPin: "GPIO 35 (ADC1_CH7)" },
  { id: "pinky", name: "Pinky", tamilName: "சிறுவிரல்", sensorKey: "flex5", gpioPin: "GPIO 32 (ADC1_CH4)" },
];

export interface FlexSensorCalibration {
  id: FingerId;
  min: number; // Raw ADC value when finger is open/straight (0%)
  max: number; // Raw ADC value when finger is fully flexed/bent (100%)
  inverted: boolean; // True if sensor ADC decreases when bent
}

export interface GestureThresholdRule {
  code: string;
  name: string;
  tamilName: string;
  description: string;
  tamilDescription: string;
  fingers: Record<FingerId, FingerRequirement>;
  bendThreshold: number; // default 60%
  straightThreshold: number; // default 35%
  tolerance: number; // default 20%
  custom?: boolean;
}

export interface NaturalHandPose {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  recordedAt?: string;
}

export interface CalibrationProfile {
  userId: string;
  updatedAt: string;
  sensitivity: "standard" | "high" | "strict";
  sensors: Record<FingerId, FlexSensorCalibration>;
  naturalOpenHand: NaturalHandPose;
  naturalClosedFist: NaturalHandPose;
  customGesturePoses: Record<string, NaturalHandPose>;
  gestureRules: Record<string, GestureThresholdRule>;
}

export interface RecognitionResult {
  matchedRule: GestureThresholdRule | null;
  confidence: number; // 0 - 100
  fingerMatches: Record<FingerId, boolean>;
  fingerPercentages: Record<FingerId, number>;
  candidates: {
    rule: GestureThresholdRule;
    confidence: number;
    fingerMatches: Record<FingerId, boolean>;
  }[];
}
