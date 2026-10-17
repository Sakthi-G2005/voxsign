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
import { useLanguage } from "@/lib/i18n";

export function PrivateChat({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
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
            ? t("no_linked_senders")
            : t("private_chat_unlocks")}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link to="/profile">
            {profile.role === "receiver" ? t("view_caregiver_invitations") : t("add_trusted_caregiver")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="surface-card p-2">
        <p className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {profile.role === "receiver" ? t("linked_senders") : t("trusted_caregivers")}
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
                  {p.isPrimary ? ` · ${t("primary_badge")}` : ""}
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
  const { t, language } = useLanguage();
  const { data: messages = [], isLoading } = useChatMessages(partner);
  const send = useSendChatMessage(partner, profile.id);
  const markRead = useMarkChatRead(partner, profile.id);
  const speaker = useSpeaker();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const quickReplies =
    language === "ta"
      ? [
          "வணக்கம்!",
          "எப்படி இருக்கிறீர்கள்?",
          "எனக்கு உதவி தேவை",
          "நன்றி!",
          "உங்களுக்கு உதவ நான் வருகிறேன்.",
          "எல்லாம் நலமாக உள்ளது.",
        ]
      : [
          "Hello!",
          "How are you?",
          "I need help",
          "Thank you!",
          "I am on my way to help you.",
          "Everything is okay.",
        ];

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
      toast.error(t("choose_photo_video"));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t("file_too_large"));
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
      toast.error(t("mic_permission_needed"));
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
          <ShieldCheck className="h-3.5 w-3.5" /> {t("chat_private")}
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
                  {mine && m.read_at ? ` · ${t("chat_read")}` : ""}
                  {!mine && speaker.enabled && m.body ? (
                    <button
                      type="button"
                      aria-label={t("chat_speak")}
                      title={t("chat_speak")}
                      onClick={() => speaker.speak(`${t("message_from")} ${partner.name}. ${m.body}`)}
                      className="inline-flex items-center gap-1 opacity-100 hover:underline cursor-pointer"
                    >
                      <Volume2 className="h-3 w-3" /> {t("chat_speak")}
                    </button>
                  ) : null}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("no_messages_yet")}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick message shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border/50 bg-secondary/30 px-3 py-2 text-xs">
        <span className="shrink-0 text-muted-foreground font-medium">{t("quick_replies")}:</span>
        {quickReplies.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => setText((prev) => (prev ? `${prev} ${reply}` : reply))}
            className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-primary/10 hover:border-primary/40 cursor-pointer shadow-2xs"
          >
            {reply}
          </button>
        ))}
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
          title={t("send_photo_video")}
          aria-label={t("send_photo_video")}
          disabled={send.isPending || recording}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={recording ? "destructive" : "outline"}
          title={recording ? t("stop_send_voice") : t("record_voice")}
          aria-label={recording ? t("stop_send_voice") : t("record_voice")}
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
          placeholder={t("write_private_message")}
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
  const { t } = useLanguage();
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
        <p className="text-[11px] opacity-70">{t("voice_message")} · {message.attachment_duration}s</p>
      ) : null}
    </div>
  );
}
