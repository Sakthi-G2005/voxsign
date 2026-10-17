import type { FingerId } from "./types";
import { FINGERS } from "./types";
import { cn } from "@/lib/utils";

interface HandVisualizerProps {
  percentages: Record<FingerId, number>;
  fingerMatches?: Record<FingerId, boolean>;
  targetRequirements?: Record<FingerId, "bent" | "straight" | "any">;
  language?: "en" | "ta";
  compact?: boolean;
}

export function HandVisualizer({
  percentages,
  fingerMatches,
  targetRequirements,
  language = "en",
  compact = false,
}: HandVisualizerProps) {
  // Finger positions and dimensions for rendering
  const fingerConfigs: Record<
    FingerId,
    { x: number; baseY: number; maxH: number; width: number; angle: number }
  > = {
    thumb: { x: 38, baseY: 175, maxH: 60, width: 22, angle: -32 },
    index: { x: 80, baseY: 140, maxH: 95, width: 20, angle: -6 },
    middle: { x: 112, baseY: 135, maxH: 105, width: 21, angle: 0 },
    ring: { x: 144, baseY: 140, maxH: 92, width: 20, angle: 6 },
    pinky: { x: 174, baseY: 155, maxH: 72, width: 18, angle: 16 },
  };

  const getFingerColor = (id: FingerId, pct: number) => {
    if (fingerMatches && fingerMatches[id]) {
      return "fill-emerald-500 stroke-emerald-600 dark:fill-emerald-600 dark:stroke-emerald-400";
    }
    if (pct >= 65) {
      return "fill-rose-500 stroke-rose-600 dark:fill-rose-600 dark:stroke-rose-400";
    }
    if (pct >= 35) {
      return "fill-amber-500 stroke-amber-600 dark:fill-amber-600 dark:stroke-amber-400";
    }
    return "fill-blue-500 stroke-blue-600 dark:fill-blue-600 dark:stroke-blue-400";
  };

  return (
    <div className={cn("flex flex-col items-center", compact ? "p-2" : "p-4")}>
      <svg
        viewBox="0 0 240 250"
        className={cn("w-full transition-all drop-shadow-md", compact ? "max-w-[200px]" : "max-w-[280px]")}
      >
        {/* Palm Background Glow */}
        <circle cx="125" cy="190" r="45" className="fill-primary/5" />

        {/* Fingers (drawn dynamically bending by reducing height and increasing curvature) */}
        {(Object.keys(fingerConfigs) as FingerId[]).map((id) => {
          const cfg = fingerConfigs[id];
          const pct = Math.max(0, Math.min(100, percentages[id] ?? 0));
          // Height shrinks as finger bends (from 100% straight down to 35% when fully curled)
          const bendFactor = 1 - (pct / 100) * 0.65;
          const currentHeight = cfg.maxH * bendFactor;
          const topY = cfg.baseY - currentHeight;

          const colorClass = getFingerColor(id, pct);

          return (
            <g key={id} transform={`rotate(${cfg.angle} ${cfg.x + cfg.width / 2} ${cfg.baseY})`}>
              {/* Joint segments */}
              <rect
                x={cfg.x}
                y={topY}
                width={cfg.width}
                height={currentHeight + 15}
                rx={cfg.width / 2}
                className={cn(
                  "transition-all duration-200 stroke-2",
                  colorClass,
                )}
              />

              {/* Knuckle crease indicators */}
              <line
                x1={cfg.x + 3}
                y1={topY + currentHeight * 0.35}
                x2={cfg.x + cfg.width - 3}
                y2={topY + currentHeight * 0.35}
                className="stroke-white/40 dark:stroke-black/30 stroke-1"
              />
              <line
                x1={cfg.x + 3}
                y1={topY + currentHeight * 0.68}
                x2={cfg.x + cfg.width - 3}
                y2={topY + currentHeight * 0.68}
                className="stroke-white/40 dark:stroke-black/30 stroke-1"
              />

              {/* Fingernail accent */}
              <ellipse
                cx={cfg.x + cfg.width / 2}
                cy={topY + 6}
                rx={cfg.width / 3.5}
                ry={4}
                className="fill-white/30 dark:fill-white/20"
              />
            </g>
          );
        })}

        {/* Palm Body */}
        <path
          d="M 55 175 C 50 195 55 235 95 240 C 145 242 185 240 195 210 C 200 185 195 160 185 155 C 160 148 100 145 55 175 Z"
          className="fill-card stroke-border stroke-2 drop-shadow-sm"
        />

        {/* Palm Crease Lines */}
        <path
          d="M 80 185 Q 115 195 145 180"
          className="fill-none stroke-border/70 stroke-2 stroke-linecap-round"
        />
        <path
          d="M 75 205 Q 110 215 155 198"
          className="fill-none stroke-border/60 stroke-2 stroke-linecap-round"
        />
        <path
          d="M 90 225 Q 125 220 165 212"
          className="fill-none stroke-border/50 stroke-1.5 stroke-linecap-round"
        />

        {/* Wrist Connection */}
        <rect
          x="95"
          y="238"
          width="60"
          height="12"
          rx="4"
          className="fill-muted stroke-border stroke-1"
        />
      </svg>

      {/* Mini Legend / Percentage Pills under Hand */}
      <div className="mt-3 grid grid-cols-5 gap-1.5 w-full max-w-[340px] text-center">
        {FINGERS.map((f) => {
          const pct = percentages[f.id] ?? 0;
          const match = fingerMatches?.[f.id];
          const req = targetRequirements?.[f.id];

          return (
            <div
              key={f.id}
              className={cn(
                "flex flex-col items-center justify-between rounded-lg p-1.5 border transition-all text-[11px]",
                match === true
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : match === false
                  ? "border-rose-500/40 bg-rose-500/5 text-rose-500"
                  : "border-border bg-secondary/50 text-muted-foreground",
              )}
            >
              <span className="font-semibold truncate max-w-full">
                {language === "ta" ? f.tamilName.slice(0, 4) : f.name.slice(0, 4)}
              </span>
              <span className="font-mono text-[12px] font-bold text-foreground">
                {pct}%
              </span>
              {req && req !== "any" ? (
                <span className="text-[9px] px-1 rounded bg-background/80 font-medium">
                  {req === "bent"
                    ? language === "ta"
                      ? "வளைவு"
                      : "Bent"
                    : language === "ta"
                    ? "நேர்"
                    : "Str"}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
