import type {
  FingerId,
  FlexSensorCalibration,
  GestureThresholdRule,
  RecognitionResult,
} from "./types";

/**
 * Normalizes a raw ADC sensor reading into a 0 - 100% bend percentage based on
 * the user's calibrated min and max.
 */
export function normalizeRawReading(
  raw: number,
  calibration: FlexSensorCalibration,
): number {
  const { min, max, inverted } = calibration;
  if (max === min) return 0;

  // Calculate percentage
  let percent = ((raw - min) / (max - min)) * 100;
  percent = Math.max(0, Math.min(100, percent));

  if (inverted) {
    percent = 100 - percent;
  }

  return Math.round(percent);
}

/**
 * Normalizes all 5 raw readings to bend percentages.
 */
export function normalizeAllSensors(
  rawValues: Record<FingerId, number>,
  calibrations: Record<FingerId, FlexSensorCalibration>,
): Record<FingerId, number> {
  return {
    thumb: normalizeRawReading(rawValues.thumb, calibrations.thumb),
    index: normalizeRawReading(rawValues.index, calibrations.index),
    middle: normalizeRawReading(rawValues.middle, calibrations.middle),
    ring: normalizeRawReading(rawValues.ring, calibrations.ring),
    pinky: normalizeRawReading(rawValues.pinky, calibrations.pinky),
  };
}

/**
 * Tests whether a specific finger meets the requirement defined by a gesture threshold rule.
 */
export function testFingerMatch(
  bendPercent: number,
  requirement: "bent" | "straight" | "any",
  rule: GestureThresholdRule,
  sensitivityMultiplier: number = 1.0,
): { match: boolean; score: number } {
  if (requirement === "any") {
    return { match: true, score: 1.0 };
  }

  const effectiveBendThreshold = Math.max(
    40,
    rule.bendThreshold * sensitivityMultiplier,
  );
  const effectiveStraightThreshold = Math.min(
    50,
    rule.straightThreshold / sensitivityMultiplier,
  );

  if (requirement === "bent") {
    if (bendPercent >= effectiveBendThreshold) {
      // Full match, score increases as finger is deeper into bend
      const excess = bendPercent - effectiveBendThreshold;
      const score = 0.8 + 0.2 * (excess / (100 - effectiveBendThreshold || 1));
      return { match: true, score: Math.min(1.0, score) };
    } else {
      // Partial match within tolerance
      const diff = effectiveBendThreshold - bendPercent;
      if (diff <= rule.tolerance) {
        return { match: false, score: 0.5 * (1 - diff / rule.tolerance) };
      }
      return { match: false, score: 0 };
    }
  }

  if (requirement === "straight") {
    if (bendPercent <= effectiveStraightThreshold) {
      const remaining = effectiveStraightThreshold - bendPercent;
      const score = 0.8 + 0.2 * (remaining / (effectiveStraightThreshold || 1));
      return { match: true, score: Math.min(1.0, score) };
    } else {
      const diff = bendPercent - effectiveStraightThreshold;
      if (diff <= rule.tolerance) {
        return { match: false, score: 0.5 * (1 - diff / rule.tolerance) };
      }
      return { match: false, score: 0 };
    }
  }

  return { match: false, score: 0 };
}

/**
 * Evaluates current finger percentages against all gesture threshold rules and
 * returns the best matching gesture with confidence score and candidate breakdown.
 */
export function evaluateGestureRecognition(
  currentPercentages: Record<FingerId, number>,
  rules: Record<string, GestureThresholdRule>,
  sensitivity: "standard" | "high" | "strict" = "standard",
): RecognitionResult {
  // Sensitivity multipliers:
  // "high": more lenient thresholds, easier to trigger
  // "strict": requires higher adherence
  const multiplier = sensitivity === "high" ? 0.85 : sensitivity === "strict" ? 1.15 : 1.0;

  const candidateResults: {
    rule: GestureThresholdRule;
    confidence: number;
    fingerMatches: Record<FingerId, boolean>;
    allMatched: boolean;
  }[] = [];

  const fingerKeys: FingerId[] = ["thumb", "index", "middle", "ring", "pinky"];

  for (const rule of Object.values(rules)) {
    const fingerMatches: Record<FingerId, boolean> = {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    };

    let totalScore = 0;
    let requiredCount = 0;
    let matchedCount = 0;

    for (const f of fingerKeys) {
      const req = rule.fingers[f];
      const bend = currentPercentages[f] ?? 0;
      const { match, score } = testFingerMatch(bend, req, rule, multiplier);

      fingerMatches[f] = match;
      if (req !== "any") {
        requiredCount++;
        totalScore += score;
        if (match) matchedCount++;
      } else {
        totalScore += 1.0;
      }
    }

    const allMatched = matchedCount === requiredCount;
    const baseConfidence = (totalScore / 5) * 100;
    // Boost confidence if all required fingers matched
    const confidence = Math.round(
      allMatched ? Math.min(100, Math.max(75, baseConfidence)) : Math.min(68, baseConfidence * 0.7),
    );

    candidateResults.push({
      rule,
      confidence,
      fingerMatches,
      allMatched,
    });
  }

  // Sort candidates by highest confidence
  candidateResults.sort((a, b) => b.confidence - a.confidence);

  const bestCandidate = candidateResults[0];

  // We consider it a solid match if all required fingers matched and confidence >= 70%
  const matchedRule =
    bestCandidate && bestCandidate.allMatched && bestCandidate.confidence >= 70
      ? bestCandidate.rule
      : null;

  return {
    matchedRule,
    confidence: bestCandidate ? bestCandidate.confidence : 0,
    fingerMatches: bestCandidate
      ? bestCandidate.fingerMatches
      : { thumb: false, index: false, middle: false, ring: false, pinky: false },
    fingerPercentages: currentPercentages,
    candidates: candidateResults.slice(0, 4).map((c) => ({
      rule: c.rule,
      confidence: c.confidence,
      fingerMatches: c.fingerMatches,
    })),
  };
}
