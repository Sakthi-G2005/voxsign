import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Mail,
  Phone,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useTrustedContacts } from "@/features/contacts";
import type { Profile } from "@/lib/domain";
import { useLanguage } from "@/lib/i18n";
import {
  getNotificationSettings,
  saveNotificationSettings,
  sendSmsReal,
  sendEmailReal,
  type NotificationSettings as NotificationSettingsType,
  type SmsProvider,
  type EmailProvider,
} from "@/lib/notifications";

export function NotificationSettings({ profile }: { profile: Profile }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isTamil = language === "ta";

  const { data: contacts = [] } = useTrustedContacts(profile.id);

  const [settings, setSettings] = useState<NotificationSettingsType>(getNotificationSettings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    sms?: { success: boolean; text: string };
    email?: { success: boolean; text: string };
  } | null>(null);

  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");

  const saveProfileContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: phone.trim() || null,
          email: email.trim() || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        isTamil
          ? "தொடர்பு விவரங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன"
          : "Contact details saved successfully",
      );
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateSetting<K extends keyof NotificationSettingsType>(
    key: K,
    val: NotificationSettingsType[K],
  ) {
    const updated = saveNotificationSettings({ [key]: val });
    setSettings(updated);
  }

  async function handleTestRealDelivery() {
    setTesting(true);
    setTestResult(null);

    const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
    const targetPhone = primaryContact?.phone || phone;
    const targetEmail = primaryContact?.email || email;

    if (!targetPhone && !targetEmail) {
      toast.error(
        isTamil
          ? "சோதனை செய்ய பாதுகாவலரின் தொலைபேசி எண் அல்லது மின்னஞ்சலை சேர்க்கவும்"
          : "Please add a caregiver's phone number or email to test delivery",
      );
      setTesting(false);
      return;
    }

    const testMsg = isTamil
      ? "🚨 VoxSign சோதனை அறிவிப்பு: உங்கள் அவசர எச்சரிக்கை அமைப்பு வெற்றிகரமாக இணைக்கப்பட்டுள்ளது!"
      : "🚨 VoxSign Test Alert: Your emergency alert delivery is verified and working!";

    const results: {
      sms?: { success: boolean; text: string };
      email?: { success: boolean; text: string };
    } = {};

    // 1. Test SMS
    if (settings.smsEnabled && targetPhone) {
      const res = await sendSmsReal(targetPhone, testMsg);
      results.sms = { success: res.success, text: `[${res.provider}] ${res.statusText}` };
      if (res.success) {
        toast.success(`SMS: ${res.statusText}`);
      } else {
        toast.warning(`SMS: ${res.statusText}`);
      }
    }

    // 2. Test Email
    if (settings.emailEnabled && targetEmail) {
      const res = await sendEmailReal(
        targetEmail,
        isTamil ? "🚨 VoxSign சோதனை எச்சரிக்கை" : "🚨 VoxSign Emergency Test Alert",
        testMsg,
        profile.full_name || "Sender",
      );
      results.email = { success: res.success, text: `[${res.provider}] ${res.statusText}` };
      if (res.success) {
        toast.success(`Email: ${res.statusText}`);
      } else {
        toast.warning(`Email: ${res.statusText}`);
      }
    }

    setTestResult(results);
    setTesting(false);
  }

  return (
    <section className="surface-card p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {isTamil ? "SMS & மின்னஞ்சல் நேரலை டெலிவரி" : "Real SMS & Email Notification Delivery"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isTamil
                ? "உண்மையான தொலைபேசி எண்கள் மற்றும் இன்பாக்ஸ்களுக்கு நேரடி அறிவிப்பு அமைப்புகள்"
                : "Configure real live delivery to caregiver mobile phones and inboxes"}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="default"
          onClick={handleTestRealDelivery}
          disabled={testing}
          className="cursor-pointer font-semibold shadow-sm"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          {testing
            ? isTamil
              ? "சோதிக்கப்படுகிறது..."
              : "Testing Delivery..."
            : isTamil
              ? "நேரலை டெலிவரி சோதனை"
              : "Test Live Delivery"}
        </Button>
      </div>

      {/* Test Results Banner */}
      {testResult && (
        <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-2 animate-in fade-in duration-200">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            {isTamil ? "டெலிவரி சோதனை முடிவுகள்:" : "Live Delivery Test Results:"}
          </p>
          {testResult.sms && (
            <div className="flex items-start gap-2 text-xs">
              <span className="font-semibold text-foreground">SMS:</span>
              <span
                className={
                  testResult.sms.success ? "text-success font-medium" : "text-warning font-medium"
                }
              >
                {testResult.sms.text}
              </span>
            </div>
          )}
          {testResult.email && (
            <div className="flex items-start gap-2 text-xs">
              <span className="font-semibold text-foreground">Email:</span>
              <span
                className={
                  testResult.email.success ? "text-info font-medium" : "text-warning font-medium"
                }
              >
                {testResult.email.text}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 1. SMS Delivery Gateway Configuration */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                {isTamil ? "1. SMS டெலிவரி சேவை (SMS Gateway)" : "1. SMS Delivery Gateway"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isTamil
                  ? "பாதுகாவலர்களின் மொபைல் எண்களுக்கு SMS அனுப்பும் முறையைத் தேர்ந்தெடுக்கவும்"
                  : "Choose how SMS text messages are sent to caregiver phones"}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.smsEnabled}
            onCheckedChange={(val) => updateSetting("smsEnabled", val)}
          />
        </div>

        {settings.smsEnabled && (
          <div className="space-y-4 pt-2">
            {/* Provider Selector */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "fast2sms", label: "Fast2SMS (India)", badge: "Free / Instant" },
                { id: "twilio", label: "Twilio (Global)", badge: "Worldwide" },
                { id: "webhook", label: "Custom Webhook", badge: "Zapier / Make" },
                { id: "device", label: "Phone SIM", badge: "Carrier SIM" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateSetting("smsProvider", p.id as SmsProvider)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    settings.smsProvider === p.id
                      ? "border-primary bg-primary/5 text-foreground shadow-xs font-semibold"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="text-xs">{p.label}</span>
                  <span className="text-[10px] text-primary/80">{p.badge}</span>
                </button>
              ))}
            </div>

            {/* Provider Inputs */}
            {settings.smsProvider === "fast2sms" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fast2sms-key" className="font-semibold text-foreground">
                    Fast2SMS API Key
                  </Label>
                  <a
                    href="https://www.fast2sms.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    {isTamil ? "இலவச சாவி பெறுக" : "Get Free Key"} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Input
                  id="fast2sms-key"
                  type="password"
                  placeholder="Paste your Fast2SMS Authorization key here"
                  value={settings.fast2smsApiKey}
                  onChange={(e) => updateSetting("fast2smsApiKey", e.target.value)}
                  className="font-mono text-xs bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  {isTamil
                    ? "இந்தியாவில் எந்தவொரு மொபைல் எண்ணுக்கும் உடனடி SMS அனுப்ப Fast2SMS-ல் இலவச கணக்கு தொடங்கி சாவியை ஒட்டவும்."
                    : "Fast2SMS sends real instant SMS to any 10-digit Indian mobile number (+91). Free credits included on sign up."}
                </p>
              </div>
            )}

            {settings.smsProvider === "twilio" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tw-sid" className="text-xs">
                      Twilio Account SID
                    </Label>
                    <Input
                      id="tw-sid"
                      placeholder="ACxxxxxxxxxxxxxxxx"
                      value={settings.twilioSid}
                      onChange={(e) => updateSetting("twilioSid", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tw-token" className="text-xs">
                      Twilio Auth Token
                    </Label>
                    <Input
                      id="tw-token"
                      type="password"
                      placeholder="Your Twilio token"
                      value={settings.twilioToken}
                      onChange={(e) => updateSetting("twilioToken", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tw-from" className="text-xs">
                      Twilio Phone Number
                    </Label>
                    <Input
                      id="tw-from"
                      placeholder="+1234567890"
                      value={settings.twilioFrom}
                      onChange={(e) => updateSetting("twilioFrom", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {settings.smsProvider === "webhook" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <Label htmlFor="sms-webhook-url" className="font-semibold text-foreground">
                  Custom SMS Webhook URL (Zapier / Make / n8n)
                </Label>
                <Input
                  id="sms-webhook-url"
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={settings.smsWebhookUrl}
                  onChange={(e) => updateSetting("smsWebhookUrl", e.target.value)}
                  className="font-mono text-xs bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  POSTs JSON <code>{`{ channel: "sms", to, message }`}</code> to your webhook
                  trigger.
                </p>
              </div>
            )}

            {settings.smsProvider === "device" && (
              <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground border border-border/60">
                {isTamil
                  ? "கிளவுட் SMS சாவி தேவையில்லை — அவசர சைகை தூண்டப்படும் போது மொபைல் சிம் வழியாக SMS அனுப்பப்படும்."
                  : "Uses your phone's cellular carrier plan directly to send SMS messages."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Email Delivery Gateway Configuration */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                {isTamil ? "2. மின்னஞ்சல் டெலிவரி சேவை (Email Gateway)" : "2. Email Delivery Gateway"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isTamil
                  ? "பாதுகாவலர்களின் இன்பாக்ஸுக்கு அவசர மின்னஞ்சல் அனுப்பும் சேவை"
                  : "Choose how emergency emails are sent directly to caregiver inboxes"}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.emailEnabled}
            onCheckedChange={(val) => updateSetting("emailEnabled", val)}
          />
        </div>

        {settings.emailEnabled && (
          <div className="space-y-4 pt-2">
            {/* Email Provider Selector */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: "emailjs", label: "EmailJS", badge: "Free 200/mo · No backend" },
                { id: "resend", label: "Resend API", badge: "Developer API" },
                { id: "webhook", label: "Email Webhook", badge: "Zapier / Gmail" },
                { id: "device", label: "Mail App", badge: "Local Client" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateSetting("emailProvider", p.id as EmailProvider)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    settings.emailProvider === p.id
                      ? "border-info bg-info/5 text-foreground shadow-xs font-semibold"
                      : "border-border bg-card text-muted-foreground hover:border-info/40"
                  }`}
                >
                  <span className="text-xs">{p.label}</span>
                  <span className="text-[10px] text-info/80">{p.badge}</span>
                </button>
              ))}
            </div>

            {/* Email Provider Inputs */}
            {settings.emailProvider === "emailjs" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">EmailJS Credentials</p>
                  <a
                    href="https://www.emailjs.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-info hover:underline font-medium"
                  >
                    {isTamil ? "இலவச சாவி பெறுக" : "Get Free EmailJS Key"}{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ejs-key" className="text-xs">
                      Public Key (User ID)
                    </Label>
                    <Input
                      id="ejs-key"
                      placeholder="e.g. user_abcdef123"
                      value={settings.emailjsPublicKey}
                      onChange={(e) => updateSetting("emailjsPublicKey", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ejs-svc" className="text-xs">
                      Service ID
                    </Label>
                    <Input
                      id="ejs-svc"
                      placeholder="e.g. service_voxsign"
                      value={settings.emailjsServiceId}
                      onChange={(e) => updateSetting("emailjsServiceId", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ejs-tpl" className="text-xs">
                      Template ID
                    </Label>
                    <Input
                      id="ejs-tpl"
                      placeholder="e.g. template_alert"
                      value={settings.emailjsTemplateId}
                      onChange={(e) => updateSetting("emailjsTemplateId", e.target.value)}
                      className="font-mono text-xs bg-background"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  EmailJS delivers directly from the browser to any recipient email with 200 free
                  emails per month.
                </p>
              </div>
            )}

            {settings.emailProvider === "resend" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <Label htmlFor="resend-key" className="font-semibold text-foreground">
                  Resend API Key
                </Label>
                <Input
                  id="resend-key"
                  type="password"
                  placeholder="re_xxxxxxxxxxxxxxxx"
                  value={settings.resendApiKey}
                  onChange={(e) => updateSetting("resendApiKey", e.target.value)}
                  className="font-mono text-xs bg-background"
                />
              </div>
            )}

            {settings.emailProvider === "webhook" && (
              <div className="rounded-xl bg-secondary/40 p-4 space-y-3 text-xs border border-border/60">
                <Label htmlFor="email-webhook-url" className="font-semibold text-foreground">
                  Custom Email Webhook URL (Zapier / Make / Gmail)
                </Label>
                <Input
                  id="email-webhook-url"
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={settings.emailWebhookUrl}
                  onChange={(e) => updateSetting("emailWebhookUrl", e.target.value)}
                  className="font-mono text-xs bg-background"
                />
              </div>
            )}

            {settings.emailProvider === "device" && (
              <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground border border-border/60">
                {isTamil
                  ? "அவசர சைகை தூண்டப்படும் போது உங்கள் சாதனத்தின் இயல்புநிலை அஞ்சல் செயலி தானாகவே திறக்கும்."
                  : "Opens your device's default mail client with prefilled recipient and emergency text."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. My Contact Info for Caregiver Status Updates */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {isTamil
              ? "3. எனது தொடர்பு விவரங்கள் (நிலை அறிவிப்புகளுக்கு)"
              : "3. My Contact Info (For Caregiver Status Updates)"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTamil
              ? "பாதுகாவலர் உதவிக்கு வரும்போது உங்கள் மொபைலுக்கு SMS மற்றும் மின்னஞ்சல் வர இந்த விவரங்களை உள்ளிடவும்."
              : "Receive status updates on your phone and email when caregivers acknowledge your request."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="my-phone">
              {isTamil ? "மொபைல் எண் (+91XXXXXXXXXX)" : "Mobile Phone (+91XXXXXXXXXX)"}
            </Label>
            <Input
              id="my-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="my-email">
              {isTamil ? "மின்னஞ்சல் முகவரி" : "Email Address"}
            </Label>
            <Input
              id="my-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              maxLength={255}
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => saveProfileContact.mutate()}
          disabled={saveProfileContact.isPending}
          className="cursor-pointer"
        >
          {saveProfileContact.isPending
            ? isTamil
              ? "சேமிக்கப்படுகிறது..."
              : "Saving..."
            : isTamil
              ? "தொடர்பு விவரங்களை சேமி"
              : "Save Contact Info"}
        </Button>
      </div>

      {/* 4. Caregiver Notification Delivery Directory */}
      <div className="rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isTamil ? "பாதுகாவலர்களின் டெலிவரி தயார்நிலை" : "Caregiver Delivery Readiness"}
          </h3>
        </div>

        {contacts.length ? (
          <ul className="mt-3 space-y-2">
            {contacts.map((c) => {
              const hasPhone = Boolean(c.phone && c.phone.trim().length >= 8);
              const hasEmail = Boolean(c.email && c.email.includes("@"));

              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground">{c.contact_name}</span>
                    <span className="ml-1.5 text-muted-foreground">({c.relationship})</span>
                    {c.is_primary && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {isTamil ? "முதன்மை" : "Primary"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        hasPhone
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground line-through opacity-70"
                      }`}
                    >
                      <Phone className="h-3 w-3" />
                      {hasPhone ? c.phone : isTamil ? "SMS எண் இல்லை" : "No Phone"}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        hasEmail
                          ? "bg-info/10 text-info"
                          : "bg-muted text-muted-foreground line-through opacity-70"
                      }`}
                    >
                      <Mail className="h-3 w-3" />
                      {hasEmail ? c.email : isTamil ? "மின்னஞ்சல் இல்லை" : "No Email"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {isTamil
              ? "பாதுகாவலர்கள் இன்னும் சேர்க்கப்படவில்லை. மேலே உள்ள பிரிவில் சேர்க்கவும்."
              : "No trusted caregivers added yet. Add them in the section above."}
          </p>
        )}
      </div>
    </section>
  );
}
