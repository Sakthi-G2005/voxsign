import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Loader2, Mic, Send, ShieldCheck, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { relativeTime, type Profile } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  useAttachmentUrl,
  useChatMessages,
  useChatPartners,
  useChatRealtime,
  useMarkChatRead,
  useSendChatMessage,
  type ChatMessage,
  type ChatPartner,
} from "@/features/chat";
import { useSpeaker } from "@/features/speaker";

export function PrivateChat({ profile }: { profile: Profile }) {
  const { data: partners = [], isLoading } = useChatPartners(profile);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useChatRealtime();

  const active = useMemo(() => {
    if (!partners.length) return undefined;
    return partners.find((p) => keyOf(p) === activeKey) ?? partners[0];
  }, [partners, activeKey]);

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!partners.length) {
    return (
      <div className="surface-card p-6">
        <p className="text-sm text-muted-foreground">
          {profile.role === "receiver"
            ? "No linked senders yet. Accept a caregiver invitation to start a private chat."
            : "Private chat unlocks once a trusted caregiver accepts your link request."}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link to="/profile">
            {profile.role === "receiver" ? "View caregiver invitations" : "Add a trusted caregiver"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="surface-card p-2">
        <p className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {profile.role === "receiver" ? "Linked senders" : "Trusted caregivers"}
        </p>
        <ul className="space-y-1">
          {partners.map((p) => (
            <li key={keyOf(p)}>
              <button
                onClick={() => setActiveKey(keyOf(p))}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary",
                  active && keyOf(active) === keyOf(p) && "bg-secondary",
                )}
              >
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.relationship}
                  {p.isPrimary ? " · Primary" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {active ? <ChatPanel key={keyOf(active)} profile={profile} partner={active} /> : null}
    </div>
  );
}

function keyOf(p: ChatPartner) {
  return `${p.senderId}:${p.receiverId}`;
}

function ChatPanel({ profile, partner }: { profile: Profile; partner: ChatPartner }) {
  const { data: messages = [], isLoading } = useChatMessages(partner);
  const send = useSendChatMessage(partner, profile.id);
  const markRead = useMarkChatRead(partner, profile.id);
  const speaker = useSpeaker();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const unread = messages.some((m) => m.author_id !== profile.id && !m.read_at);
  useEffect(() => {
    if (unread) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // New incoming messages are spoken app-wide by useChatSpeakerAlerts.

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate({ body }, { onError: (error) => toast.error(error.message) });
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!kind) {
      toast.error("Please choose a photo or a video.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File is too large (max 50 MB).");
      return;
    }
    send.mutate(
      { file, kind, filename: file.name },
      { onError: (error) => toast.error(error.message) },
    );
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        setRecording(false);
        recorderRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return;
        send.mutate(
          {
            file: blob,
            kind: "audio",
            filename: "voice.webm",
            duration: Math.round((Date.now() - startedAt) / 1000),
          },
          { onError: (error) => toast.error(error.message) },
        );
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission is needed to record a voice message.");
    }
  }

  return (
    <section className="surface-card flex min-h-[420px] flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="font-display text-base font-semibold">{partner.name}</p>
          <p className="text-xs text-muted-foreground">{partner.relationship}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
          <ShieldCheck className="h-3.5 w-3.5" /> Private
        </span>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : messages.length ? (
          messages.map((m) => {
            const mine = m.author_id === profile.id;
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  mine
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {m.attachment_path ? <Attachment message={m} /> : null}
                {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                <p className="mt-1 flex items-center gap-2 text-[11px] opacity-70">
                  {relativeTime(m.created_at)}
                  {mine && m.read_at ? " · Read" : ""}
                  {!mine && speaker.enabled && m.body ? (
                    <button
                      type="button"
                      aria-label="Read aloud"
                      title="Read aloud on speaker"
                      onClick={() => speaker.speak(`Message from ${partner.name}. ${m.body}`)}
                      className="inline-flex items-center gap-1 opacity-100 hover:underline"
                    >
                      <Volume2 className="h-3 w-3" /> Speak
                    </button>
                  ) : null}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No messages yet. Say hello — only the two of you can read this chat.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={pickFile}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          title="Send a photo or video"
          aria-label="Send a photo or video"
          disabled={send.isPending || recording}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={recording ? "destructive" : "outline"}
          title={recording ? "Stop and send voice message" : "Record a voice message"}
          aria-label={recording ? "Stop and send voice message" : "Record a voice message"}
          disabled={send.isPending}
          onClick={() => void toggleRecording()}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          rows={2}
          placeholder="Write a private message…"
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={send.isPending || !text.trim()}>
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </section>
  );
}

function Attachment({ message }: { message: ChatMessage }) {
  const { data: url, isLoading } = useAttachmentUrl(message.attachment_path);

  if (isLoading || !url) {
    return (
      <div className="mb-2 flex h-20 items-center justify-center rounded-xl bg-background/20">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (message.attachment_type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-2 block">
        <img
          src={url}
          alt="Shared photo"
          loading="lazy"
          className="max-h-64 w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  if (message.attachment_type === "video") {
    return <video src={url} controls playsInline className="mb-2 max-h-64 w-full rounded-xl" />;
  }

  return (
    <div className="mb-2">
      <audio src={url} controls className="w-56 max-w-full" />
      {message.attachment_duration ? (
        <p className="text-[11px] opacity-70">Voice message · {message.attachment_duration}s</p>
      ) : null}
    </div>
  );
}
