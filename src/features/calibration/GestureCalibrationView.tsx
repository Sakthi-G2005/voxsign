import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  Check,
  Cpu,
  Download,
  Hand,
  HelpCircle,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Volume2,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGestureEvents, useSendGesture } from "@/features/requests";
import { useSpeaker } from "@/features/speaker";
import type { Profile } from "@/lib/domain";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HandVisualizer } from "./HandVisualizer";
import {
  evaluateGestureRecognition,
  normalizeAllSensors,
  normalizeRawReading,
} from "./recognition";
import {
  generateArduinoCode,
  loadCalibrationProfile,
  resetCalibrationProfile,
  saveCalibrationProfile,
} from "./storage";
import type {
  CalibrationProfile,
  FingerId,
  FingerRequirement,
  GestureThresholdRule,
} from "./types";
import { FINGERS } from "./types";

interface GestureCalibrationViewProps {
  profile: Profile;
}

export function GestureCalibrationView({ profile: userProfile }: GestureCalibrationViewProps) {
  const { language, t } = useLanguage();
  const speaker = useSpeaker();
  const sendGesture = useSendGesture(userProfile.id);

  // Load user calibration profile
  const [profile, setProfile] = useState<CalibrationProfile>(() =>
    loadCalibrationProfile(userProfile.id),
  );

  // Input source mode: "simulator" vs "hardware"
  const [inputMode, setInputMode] = useState<"simulator" | "hardware">("simulator");

  // Simulated raw ADC sensor readings (range: 0 to 1023)
  const [simulatedRaw, setSimulatedRaw] = useState<Record<FingerId, number>>({
    thumb: 200,
    index: 210,
    middle: 220,
    ring: 210,
    pinky: 190,
  });

  // Selected gesture for threshold tuning
  const [selectedGestureCode, setSelectedGestureCode] = useState<string>("HELP");

  // Code export modal state
  const [showCodeExport, setShowCodeExport] = useState(false);

  // Fetch recent hardware gesture events for real sensor readings
  const { data: events = [] } = useGestureEvents(userProfile.id);
  const latestHardwareEvent = events[0];

  // Derive current raw sensor readings based on selected mode
  const currentRaw: Record<FingerId, number> = useMemo(() => {
    if (inputMode === "hardware" && latestHardwareEvent?.sensor_data) {
      const d = latestHardwareEvent.sensor_data;
      return {
        thumb: Number(d.flex1 ?? 200),
        index: Number(d.flex2 ?? 200),
        middle: Number(d.flex3 ?? 200),
        ring: Number(d.flex4 ?? 200),
        pinky: Number(d.flex5 ?? 200),
      };
    }
    return simulatedRaw;
  }, [inputMode, latestHardwareEvent, simulatedRaw]);

  // Current normalized bend percentages (0 - 100%)
  const currentPercentages = useMemo(() => {
    return normalizeAllSensors(currentRaw, profile.sensors);
  }, [currentRaw, profile.sensors]);

  // Real-time recognition evaluation
  const recognition = useMemo(() => {
    return evaluateGestureRecognition(
      currentPercentages,
      profile.gestureRules,
      profile.sensitivity,
    );
  }, [currentPercentages, profile.gestureRules, profile.sensitivity]);

  const activeRule = profile.gestureRules[selectedGestureCode] ?? profile.gestureRules.HELP;

  // Save changes
  const handleSave = () => {
    saveCalibrationProfile(profile);
    toast.success(t("calibration_saved"));
  };

  // Reset to factory defaults
  const handleReset = () => {
    const fresh = resetCalibrationProfile(userProfile.id);
    setProfile(fresh);
    toast.info(t("calibration_reset"));
  };

  // Update a single sensor's calibration
  const updateSensor = (id: FingerId, patch: Partial<(typeof profile.sensors)[FingerId]>) => {
    setProfile((prev) => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [id]: { ...prev.sensors[id], ...patch },
      },
    }));
  };

  // Capture straight baseline for single sensor
  const captureStraight = (id: FingerId) => {
    const rawVal = currentRaw[id];
    updateSensor(id, { min: rawVal });
    toast.success(`${id}: ${t("capture_straight")} = ${rawVal}`);
  };

  // Capture bent baseline for single sensor
  const captureBent = (id: FingerId) => {
    const rawVal = currentRaw[id];
    updateSensor(id, { max: rawVal });
    toast.success(`${id}: ${t("capture_bent")} = ${rawVal}`);
  };

  // Capture all 5 fingers for Natural Open Hand
  const recordNaturalOpen = () => {
    const newOpen = { ...currentPercentages };
    setProfile((prev) => ({
      ...prev,
      naturalOpenHand: newOpen,
    }));
    toast.success(
      language === "ta"
        ? "இயற்கையான திறந்த கை நிலை பதிவு செய்யப்பட்டது"
        : "Natural open hand baseline recorded",
    );
  };

  // Capture all 5 fingers for Natural Closed Fist
  const recordNaturalClosed = () => {
    const newClosed = { ...currentPercentages };
    setProfile((prev) => ({
      ...prev,
      naturalClosedFist: newClosed,
    }));
    toast.success(
      language === "ta"
        ? "இயற்கையான மூடிய கை நிலை பதிவு செய்யப்பட்டது"
        : "Natural closed fist baseline recorded",
    );
  };

  // Capture signature pose for currently selected gesture
  const recordGesturePose = () => {
    const pose = { ...currentPercentages };
    // Determine requirement based on current bend level
    const updatedFingers: Record<FingerId, FingerRequirement> = {
      thumb: pose.thumb > 50 ? "bent" : "straight",
      index: pose.index > 50 ? "bent" : "straight",
      middle: pose.middle > 50 ? "bent" : "straight",
      ring: pose.ring > 50 ? "bent" : "straight",
      pinky: pose.pinky > 50 ? "bent" : "straight",
    };

    setProfile((prev) => ({
      ...prev,
      customGesturePoses: {
        ...prev.customGesturePoses,
        [selectedGestureCode]: pose,
      },
      gestureRules: {
        ...prev.gestureRules,
        [selectedGestureCode]: {
          ...prev.gestureRules[selectedGestureCode],
          fingers: updatedFingers,
        },
      },
    }));

    toast.success(
      language === "ta"
        ? `${activeRule.tamilName} சைகைக்கான விரல் நிலை பதிவு செய்யப்பட்டது`
        : `Pose signature captured for ${activeRule.name}`,
    );
  };

  // Update a gesture's rule
  const updateGestureRule = (code: string, patch: Partial<GestureThresholdRule>) => {
    setProfile((prev) => ({
      ...prev,
      gestureRules: {
        ...prev.gestureRules,
        [code]: { ...prev.gestureRules[code], ...patch },
      },
    }));
  };

  // Speak recognized gesture
  const testSpeak = () => {
    if (recognition.matchedRule) {
      const msg =
        language === "ta"
          ? recognition.matchedRule.tamilName
          : recognition.matchedRule.name;
      speaker.speak(msg);
      toast.info(`${t("matched_gesture")}: ${msg}`);
    } else {
      toast.warning(t("no_gesture_matched"));
    }
  };

  // Dispatch recognized gesture to receivers
  const dispatchHelpRequest = () => {
    if (!recognition.matchedRule) {
      toast.error(t("no_gesture_matched"));
      return;
    }
    const code = recognition.matchedRule.code;
    const msg =
      language === "ta"
        ? recognition.matchedRule.tamilName
        : recognition.matchedRule.name;

    sendGesture.mutate(
      { code, message: msg },
      {
        onSuccess: () =>
          toast.success(
            language === "ta"
              ? `${msg} அனுப்பப்பட்டது!`
              : `${msg} sent to receivers!`,
          ),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="surface-card p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="h-4 w-4" />
            </span>
            <h1 className="font-display text-lg font-bold">
              {t("calibration_title")}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            {t("calibration_subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCodeExport(true)}>
            <Cpu className="h-4 w-4 mr-1.5 text-primary" /> {t("export_esp32")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> {t("reset_defaults")}
          </Button>
          <Button size="sm" onClick={handleSave} className="gradient-primary">
            <Save className="h-4 w-4 mr-1.5" /> {t("save_calibration")}
          </Button>
        </div>
      </div>

      {/* Input Source & Sensitivity Controls */}
      <div className="surface-card p-4 flex flex-wrap items-center justify-between gap-4 bg-secondary/30">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            {t("live_input_source")}:
          </span>
          <div className="flex rounded-lg border border-border p-1 bg-background">
            <button
              onClick={() => setInputMode("simulator")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-colors",
                inputMode === "simulator"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("simulator_mode")}
            </button>
            <button
              onClick={() => setInputMode("hardware")}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
                inputMode === "hardware"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Cpu className="h-3 w-3" />
              {t("live_glove")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground uppercase font-semibold">
            {t("sensitivity_label")}:
          </Label>
          <select
            value={profile.sensitivity}
            onChange={(e) =>
              setProfile((p) => ({
                ...p,
                sensitivity: e.target.value as CalibrationProfile["sensitivity"],
              }))
            }
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="standard">{t("sens_standard")}</option>
            <option value="high">{t("sens_high")}</option>
            <option value="strict">{t("sens_strict")}</option>
          </select>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="sensors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="sensors">{t("tab_sensors")}</TabsTrigger>
          <TabsTrigger value="natural">{t("tab_natural_positions")}</TabsTrigger>
          <TabsTrigger value="testing">{t("tab_test_recognition")}</TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: 5 Flex Sensors Calibration                       */}
        {/* ======================================================== */}
        <TabsContent value="sensors" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FINGERS.map((finger) => {
              const sensor = profile.sensors[finger.id];
              const raw = currentRaw[finger.id];
              const pct = currentPercentages[finger.id];

              return (
                <article
                  key={finger.id}
                  className="surface-card p-5 space-y-4 rounded-xl border transition-all hover:border-primary/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-base font-bold text-foreground">
                        {language === "ta" ? finger.tamilName : finger.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {finger.sensorKey.toUpperCase()} · {finger.gpioPin}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-mono font-bold",
                        pct >= 65
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : pct >= 35
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      )}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Realtime Bend Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t("bend_level")}</span>
                      <span className="font-mono font-medium">
                        {t("adc_raw")}: {raw}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Min: {sensor.min}</span>
                      <span>Max: {sensor.max}</span>
                    </div>
                  </div>

                  {/* Simulator Slider (when in simulator mode) */}
                  {inputMode === "simulator" && (
                    <div className="space-y-1 rounded-lg bg-secondary/50 p-2.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium">
                          Simulate Bend
                        </span>
                        <span className="font-mono">{raw}</span>
                      </div>
                      <Slider
                        min={0}
                        max={1023}
                        step={5}
                        value={[raw]}
                        onValueChange={([val]) =>
                          setSimulatedRaw((prev) => ({ ...prev, [finger.id]: val }))
                        }
                      />
                    </div>
                  )}

                  {/* Calibration Capture Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => captureStraight(finger.id)}
                    >
                      {t("capture_straight")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => captureBent(finger.id)}
                    >
                      {t("capture_bent")}
                    </Button>
                  </div>

                  {/* Manual Min/Max Inputs & Invert */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`invert-${finger.id}`}
                        checked={sensor.inverted}
                        onCheckedChange={(checked) =>
                          updateSensor(finger.id, { inverted: checked })
                        }
                      />
                      <Label
                        htmlFor={`invert-${finger.id}`}
                        className="text-[11px] cursor-pointer text-muted-foreground"
                      >
                        {t("invert_sensor")}
                      </Label>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <Input
                        type="number"
                        className="h-6 w-14 text-center p-0.5 text-xs"
                        value={sensor.min}
                        onChange={(e) =>
                          updateSensor(finger.id, { min: Number(e.target.value) })
                        }
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        type="number"
                        className="h-6 w-14 text-center p-0.5 text-xs"
                        value={sensor.max}
                        onChange={(e) =>
                          updateSensor(finger.id, { max: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: Natural Finger Positions Recorder                 */}
        {/* ======================================================== */}
        <TabsContent value="natural" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Natural Open Hand */}
            <section className="surface-card p-6 space-y-4 rounded-xl border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold">
                    {t("natural_open_hand")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("open_hand_desc")}
                  </p>
                </div>
                <Button size="sm" onClick={recordNaturalOpen} className="gradient-primary">
                  <Hand className="h-4 w-4 mr-1.5" />
                  {t("record_open_hand")}
                </Button>
              </div>

              <div className="rounded-xl bg-secondary/40 p-4">
                <HandVisualizer
                  percentages={profile.naturalOpenHand}
                  language={language}
                  compact
                />
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                {FINGERS.map((f) => (
                  <div key={f.id} className="rounded-lg bg-card p-2 border">
                    <p className="text-[10px] text-muted-foreground">
                      {language === "ta" ? f.tamilName.slice(0, 3) : f.name.slice(0, 3)}
                    </p>
                    <p className="font-bold text-sm mt-1">
                      {profile.naturalOpenHand[f.id]}%
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Natural Closed Fist */}
            <section className="surface-card p-6 space-y-4 rounded-xl border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold">
                    {t("natural_closed_fist")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("closed_fist_desc")}
                  </p>
                </div>
                <Button size="sm" onClick={recordNaturalClosed} className="gradient-emergency">
                  <Hand className="h-4 w-4 mr-1.5" />
                  {t("record_closed_fist")}
                </Button>
              </div>

              <div className="rounded-xl bg-secondary/40 p-4">
                <HandVisualizer
                  percentages={profile.naturalClosedFist}
                  language={language}
                  compact
                />
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                {FINGERS.map((f) => (
                  <div key={f.id} className="rounded-lg bg-card p-2 border">
                    <p className="text-[10px] text-muted-foreground">
                      {language === "ta" ? f.tamilName.slice(0, 3) : f.name.slice(0, 3)}
                    </p>
                    <p className="font-bold text-sm mt-1">
                      {profile.naturalClosedFist[f.id]}%
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Per-Gesture Natural Pose Recorder */}
          <section className="surface-card p-6 space-y-4 rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold">
                  {language === "ta"
                    ? "தனிப்பயன் சைகை வடிவம் பதிவு செய்தல்"
                    : "Record Signature Pose for Specific Gesture"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === "ta"
                    ? "நீங்கள் விரும்பும் சைகையைத் தேர்ந்தெடுத்து, உங்கள் விரல்களை வைத்து 'பதிவு செய்' பொத்தானை அழுத்தவும்."
                    : "Select a gesture, hold the position, and capture your unique hand signature."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedGestureCode}
                  onChange={(e) => setSelectedGestureCode(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  {Object.values(profile.gestureRules).map((r) => (
                    <option key={r.code} value={r.code}>
                      {language === "ta" ? r.tamilName : r.name} ({r.code})
                    </option>
                  ))}
                </select>

                <Button size="sm" onClick={recordGesturePose} className="bg-primary">
                  <Wand2 className="h-4 w-4 mr-1.5" />
                  {language === "ta" ? "விரல் நிலையை பதிவு செய்" : "Capture Pose"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="font-semibold text-sm">
                  {language === "ta" ? activeRule.tamilName : activeRule.name}
                </span>
                <p className="text-xs text-muted-foreground">
                  {language === "ta"
                    ? activeRule.tamilDescription
                    : activeRule.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {FINGERS.map((f) => {
                  const req = activeRule.fingers[f.id];
                  return (
                    <span
                      key={f.id}
                      className={cn(
                        "rounded-md px-2 py-1 font-mono text-[11px]",
                        req === "bent"
                          ? "bg-rose-500/10 text-rose-600"
                          : req === "straight"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {f.name}: {req}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: Gesture Thresholds & Live Testing Sandbox         */}
        {/* ======================================================== */}
        <TabsContent value="testing" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
            {/* Gesture Threshold Tuning Panel */}
            <section className="surface-card p-6 space-y-5 rounded-xl border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold">
                    {t("threshold_tune")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {language === "ta"
                      ? "ஒவ்வொரு சைகைக்குமான வளைவு வரம்புகளையும் விரல் விதிகளையும் சரிசெய்யவும்."
                      : "Adjust bend requirements and tolerances for each gesture."}
                  </p>
                </div>

                <select
                  value={selectedGestureCode}
                  onChange={(e) => setSelectedGestureCode(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold"
                >
                  {Object.values(profile.gestureRules).map((r) => (
                    <option key={r.code} value={r.code}>
                      {language === "ta" ? r.tamilName : r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold Sliders */}
              <div className="space-y-4 rounded-xl bg-secondary/30 p-4 border">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {t("bend_threshold")}
                    </span>
                    <span className="font-mono font-bold text-rose-500">
                      {activeRule.bendThreshold}%
                    </span>
                  </div>
                  <Slider
                    min={40}
                    max={90}
                    step={2}
                    value={[activeRule.bendThreshold]}
                    onValueChange={([val]) =>
                      updateGestureRule(activeRule.code, { bendThreshold: val })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {language === "ta"
                      ? "ஒரு விரல் மடிக்கப்பட்டதாக அங்கீகரிக்கப்பட வேண்டிய குறைந்தபட்ச சதவீதம்."
                      : "Minimum bend required for a finger to be marked as bent."}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {t("straight_threshold")}
                    </span>
                    <span className="font-mono font-bold text-blue-500">
                      {activeRule.straightThreshold}%
                    </span>
                  </div>
                  <Slider
                    min={10}
                    max={50}
                    step={2}
                    value={[activeRule.straightThreshold]}
                    onValueChange={([val]) =>
                      updateGestureRule(activeRule.code, { straightThreshold: val })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {language === "ta"
                      ? "ஒரு விரல் நேராகக் கருதப்பட வேண்டிய அதிகபட்ச சதவீதம்."
                      : "Maximum bend allowed for a finger to be considered straight."}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {t("tolerance_threshold")}
                    </span>
                    <span className="font-mono font-bold text-amber-500">
                      ±{activeRule.tolerance}%
                    </span>
                  </div>
                  <Slider
                    min={5}
                    max={35}
                    step={1}
                    value={[activeRule.tolerance]}
                    onValueChange={([val]) =>
                      updateGestureRule(activeRule.code, { tolerance: val })
                    }
                  />
                </div>
              </div>

              {/* Per-finger requirement toggles */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  {language === "ta"
                    ? "விரல் வாரியான தேவைகள்"
                    : "Individual Finger Requirements"}
                </Label>
                <div className="grid gap-2">
                  {FINGERS.map((f) => {
                    const req = activeRule.fingers[f.id];
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-lg border border-border p-2 bg-card text-xs"
                      >
                        <span className="font-medium">
                          {language === "ta" ? f.tamilName : f.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {(["bent", "straight", "any"] as FingerRequirement[]).map(
                            (type) => (
                              <button
                                key={type}
                                onClick={() =>
                                  updateGestureRule(activeRule.code, {
                                    fingers: {
                                      ...activeRule.fingers,
                                      [f.id]: type,
                                    },
                                  })
                                }
                                className={cn(
                                  "px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors",
                                  req === type
                                    ? type === "bent"
                                      ? "bg-rose-500 text-white"
                                      : type === "straight"
                                      ? "bg-blue-500 text-white"
                                      : "bg-secondary text-foreground font-bold"
                                    : "text-muted-foreground hover:bg-secondary",
                                )}
                              >
                                {type === "bent"
                                  ? t("req_bent")
                                  : type === "straight"
                                  ? t("req_straight")
                                  : t("req_any")}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Live Testing Sandbox */}
            <section className="surface-card p-6 space-y-5 rounded-xl border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary animate-pulse" />
                    <h3 className="font-display text-base font-bold">
                      {t("recognition_test")}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {inputMode === "simulator" ? "Simulator Active" : "ESP32 Live"}
                  </span>
                </div>

                {/* Hand Visualizer with Live Bend */}
                <div className="my-2 rounded-2xl bg-secondary/30 p-4 border">
                  <HandVisualizer
                    percentages={currentPercentages}
                    fingerMatches={recognition.fingerMatches}
                    targetRequirements={activeRule.fingers}
                    language={language}
                  />
                </div>

                {/* Interactive Simulator Sliders (if in simulator mode) */}
                {inputMode === "simulator" && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      {language === "ta"
                        ? "விரல் வளைவு உருவகப்படுத்துதல்"
                        : "Drag to Test Finger Flex"}
                    </p>
                    <div className="grid gap-2">
                      {FINGERS.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 text-xs bg-card p-2 rounded-lg border"
                        >
                          <span className="w-16 font-semibold truncate text-[11px]">
                            {language === "ta" ? f.tamilName : f.name}
                          </span>
                          <Slider
                            min={0}
                            max={1023}
                            step={10}
                            value={[simulatedRaw[f.id]]}
                            onValueChange={([val]) =>
                              setSimulatedRaw((prev) => ({ ...prev, [f.id]: val }))
                            }
                            className="flex-1"
                          />
                          <span className="w-10 text-right font-mono text-[11px]">
                            {currentPercentages[f.id]}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recognition Result Card */}
              <div
                className={cn(
                  "p-5 rounded-xl border transition-all text-center space-y-3",
                  recognition.matchedRule
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-border bg-secondary/40",
                )}
              >
                <div className="space-y-1">
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    {t("matched_gesture")}
                  </span>
                  <p className="font-display text-2xl font-bold">
                    {recognition.matchedRule ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {language === "ta"
                          ? recognition.matchedRule.tamilName
                          : recognition.matchedRule.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm font-normal">
                        {t("no_gesture_matched")}
                      </span>
                    )}
                  </p>
                </div>

                {/* Confidence Bar */}
                <div className="space-y-1 max-w-xs mx-auto">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{t("confidence")}</span>
                    <span className="font-bold">{recognition.confidence}%</span>
                  </div>
                  <Progress value={recognition.confidence} className="h-2" />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!recognition.matchedRule}
                    onClick={testSpeak}
                  >
                    <Volume2 className="h-4 w-4 mr-1.5" />
                    {t("test_voice")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!recognition.matchedRule || sendGesture.isPending}
                    onClick={dispatchHelpRequest}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Zap className="h-4 w-4 mr-1.5" />
                    {language === "ta" ? "உண்மையான கோரிக்கையை அனுப்பு" : "Send as Real Request"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Code Export Modal / Dialog */}
      {showCodeExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <h3 className="font-display text-base font-bold">
                  {t("export_esp32")}
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCodeExport(false)}
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {language === "ta"
                ? "உங்கள் அளவுத்திருத்த மதிப்புகளுடன் உருவாக்கப்பட்ட ESP32 Arduino C++ குறியீடு. இதை உங்கள் ஃபார்ம்வேரில் நேரடியாக நகலெடுத்து பயன்படுத்தலாம்."
                : "Ready-to-flash C++ configuration snippet based on your exact calibrated thresholds."}
            </p>

            <pre className="max-h-80 overflow-y-auto rounded-xl bg-secondary/80 p-4 font-mono text-[11px] leading-relaxed text-foreground select-all border">
              {generateArduinoCode(profile)}
            </pre>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(generateArduinoCode(profile));
                  toast.success(
                    language === "ta" ? "குறியீடு நகலெடுக்கப்பட்டது!" : "C++ code copied!",
                  );
                }}
              >
                <Check className="h-4 w-4 mr-1.5" />
                {language === "ta" ? "குறியீட்டை நகலெடு" : "Copy Code"}
              </Button>
              <Button size="sm" onClick={() => setShowCodeExport(false)}>
                {language === "ta" ? "மூடு" : "Close"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
