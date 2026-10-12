import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Hand, Radio, ShieldCheck, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gesture-to-Help — Real-time assistance requests" },
      {
        name: "description",
        content:
          "Gesture-to-Help connects people who need assistance with responders in real time, through the app or an ESP32 flex-sensor glove.",
      },
      { property: "og:title", content: "Gesture-to-Help — Real-time assistance requests" },
      {
        property: "og:description",
        content:
          "Send a help gesture and track it live: Sent, Delivered, Seen, Help Provided.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: Hand,
    title: "Gesture driven",
    body: "HELP, NEED ASSISTANCE and THANK YOU gestures raise a request in one tap or one hand sign.",
  },
  {
    icon: Radio,
    title: "Live status",
    body: "Every request moves through Sent → Delivered → Seen → Help Provided without a refresh.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Row-level security keeps each sender's data private while responders see only what they need.",
  },
  {
    icon: Cpu,
    title: "ESP32 ready",
    body: "A protected hardware endpoint accepts five flex-sensor readings and files a real request.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="flex items-center gap-2 font-display font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-emergency text-emergency-foreground">
            <Activity className="h-4 w-4" />
          </span>
          Gesture-to-Help
        </span>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emergency/25 bg-emergency-soft px-3 py-1 text-xs font-semibold text-emergency">
              Assistive technology project
            </span>
            <h1 className="mt-5 font-display text-4xl leading-tight font-semibold sm:text-5xl">
              A silent gesture is all it takes to ask for help.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Senders raise assistance requests from the app or a flex-sensor glove. Receivers see
              them arrive instantly and respond — every step tracked live.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">I am a receiver</Link>
              </Button>
            </div>
          </div>

          <div className="surface-card p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Live request lifecycle
            </p>
            <div className="mt-5 space-y-3">
              {[
                ["Sent", "Request created by the sender", "bg-emergency"],
                ["Delivered", "Receiver device picked it up", "bg-waiting"],
                ["Seen", "Receiver acknowledged the request", "bg-info"],
                ["Help Provided", "Assistance is on the way", "bg-success"],
              ].map(([label, body, dot]) => (
                <div key={label} className="flex items-start gap-3 rounded-lg bg-secondary p-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dot}`} />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Gesture-to-Help · Real-time assistance platform
      </footer>
    </div>
  );
}
