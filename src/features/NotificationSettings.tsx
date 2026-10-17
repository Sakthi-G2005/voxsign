import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
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
  sendSmsInBackground,
  sendEmailInBackground,
  type NotificationSettings as NotificationSettingsType,
} from "@/lib/notifications";

export function NotificationSettings({ profile }: { profile: Profile }) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isTamil = language === "ta";

  const { data: contacts = [] } = useTrustedContacts(profile.id);

  // Settings from localStorage / client config
  const [settings, setSettings] = useState<NotificationSettingsType>(getNotificationSettings);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Profile phone & email
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

  function handleTestAlert() {
    const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
    const targetPhone = primaryContact?.phone || phone;
    const targetEmail = primaryContact?.email || email;

    if (!targetPhone && !targetEmail) {
      toast.error(
        isTamil
          ? "சோதனை செய்ய ஒரு தொலைபேசி எண் அல்லது மின்னஞ்சல் முகவரியைச் சேர்க்கவும்"
          : "Please add a phone number or email address to test notifications",
      );
      return;
    }

    const testMsg = isTamil
      ? "🚨 VoxSign சோதனை அறிவிப்பு: உங்கள் SMS மற்றும் மின்னஞ்சல் எச்சரிக்கைகள் சரியாக வேலை செய்கின்றன!"
      : "🚨 VoxSign Test Alert: Your SMS & Email notifications are working properly!";

    // Automatically send SMS in background if phone available & SMS enabled
    if (settings.smsEnabled && targetPhone) {
      void sendSmsInBackground(targetPhone, testMsg);
    }

    // Automatically send Email in background if email available & Email enabled
    if (settings.emailEnabled && targetEmail) {
      void sendEmailInBackground(
        targetEmail,
        isTamil ? "🚨 VoxSign சோதனை அவசர எச்சரிக்கை" : "🚨 VoxSign Test Emergency Alert",
        testMsg,
      );
    }

    toast.success(
      isTamil
        ? "சோதனை SMS & மின்னஞ்சல் அறிவிப்புகள் தானாகவே பின்னணியில் அனுப்பப்பட்டன!"
        : "Test SMS & Email notifications sent automatically in the background!",
    );
  }

  return (
    <section className="surface-card p-6 space-y-6">
      {/* Title & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {isTamil ? "SMS & மின்னஞ்சல் அறிவிப்புகள்" : "SMS & Email Notifications"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isTamil
                ? "அவசர சைகைகள் மற்றும் நிலை அறிவிப்புகளுக்கான தானியங்கி எச்சரிக்கைகள்"
                : "Automated alert dispatch for emergency gestures and status updates"}
            </p>
          </div>
        </div>

        <Button size="sm" variant="outline" onClick={handleTestAlert} className="cursor-pointer">
          <Sparkles className="h-4 w-4 mr-1 text-primary" />
          {isTamil ? "சோதனை அறிவிப்பு அனுப்பு" : "Test Notifications"}
        </Button>
      </div>

      {/* Main Alert Channels (SMS & Email) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* SMS Channel Card */}
        <div className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {isTamil ? "SMS அறிவிப்புகள்" : "SMS Notifications"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isTamil ? "மொபைல் SMS வழியாக உடனடி செய்தி" : "Instant SMS text message alerts"}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.smsEnabled}
              onCheckedChange={(val) => {
                updateSetting("smsEnabled", val);
                toast.success(
                  val
                    ? isTamil
                      ? "SMS அறிவிப்புகள் இயக்கப்பட்டன"
                      : "SMS notifications enabled"
                    : isTamil
                      ? "SMS அறிவிப்புகள் முடக்கப்பட்டன"
                      : "SMS notifications disabled",
                );
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {isTamil ? "சேவை நிலை:" : "Channel status:"}
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                settings.smsEnabled ? "text-success" : "text-muted-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {settings.smsEnabled
                ? isTamil
                  ? "செயலில் உள்ளது"
                  : "Active & Ready"
                : isTamil
                  ? "முடக்கப்பட்டது"
                  : "Disabled"}
            </span>
          </div>
        </div>

        {/* Email Channel Card */}
        <div className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {isTamil ? "மின்னஞ்சல் அறிவிப்புகள்" : "Email Notifications"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isTamil ? "அவசர மின்னஞ்சல் எச்சரிக்கைகள்" : "Emergency HTML email dispatch"}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={(val) => {
                updateSetting("emailEnabled", val);
                toast.success(
                  val
                    ? isTamil
                      ? "மின்னஞ்சல் அறிவிப்புகள் இயக்கப்பட்டன"
                      : "Email notifications enabled"
                    : isTamil
                      ? "மின்னஞ்சல் அறிவிப்புகள் முடக்கப்பட்டன"
                      : "Email notifications disabled",
                );
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {isTamil ? "சேவை நிலை:" : "Channel status:"}
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                settings.emailEnabled ? "text-info" : "text-muted-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {settings.emailEnabled
                ? isTamil
                  ? "செயலில் உள்ளது"
                  : "Active & Ready"
                : isTamil
                  ? "முடக்கப்பட்டது"
                  : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* User's Own Phone & Email for Status Updates */}
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {isTamil ? "எனது தொடர்பு விவரங்கள் (நிலை எச்சரிக்கைகளுக்கு)" : "My Contact Info (For Caregiver Status Updates)"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTamil
              ? "பாதுகாவலர் 'பார்த்தேன்' அல்லது 'உதவிக்கு வருகிறேன்' என்று குறிக்கும் போது, இந்த எண்களுக்கு SMS மற்றும் மின்னஞ்சல் அனுப்பப்படும்."
              : "When a caregiver marks 'Seen' or 'I will help', status updates will be sent to your phone and email."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="my-phone">
              {isTamil ? "மொபைல் எண் (+நாட்டுக்குறியீடு)" : "Mobile Phone (+country code)"}
            </Label>
            <Input
              id="my-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
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

      {/* Caregiver Notification Delivery Readiness */}
      <div className="rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            {isTamil ? "பாதுகாவலர்களின் அறிவிப்பு தயார்நிலை" : "Caregivers Alert Delivery Readiness"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {isTamil
            ? "அவசர சைகை தூண்டப்படும் போது இந்த நபர்களுக்கு SMS மற்றும் மின்னஞ்சல் உடனடியாக அனுப்பப்படும்."
            : "Emergency gestures trigger instant SMS and Email notifications to these caregivers."}
        </p>

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
              ? "பாதுகாவலர்கள் இன்னும் சேர்க்கப்படவில்லை. மேலே உள்ள 'நம்பகமான பாதுகாவலர்கள்' பிரிவில் சேர்க்கவும்."
              : "No trusted caregivers added yet. Add them in the 'Trusted Caregivers' section above."}
          </p>
        )}
      </div>

      {/* Advanced Webhook & Gateway Integration (Collapsible) */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left text-xs font-semibold text-muted-foreground hover:bg-secondary/40 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            {isTamil
              ? "மேம்பட்ட Webhook மற்றும் API ஒருங்கிணைப்புகள்"
              : "Advanced Webhook & External Gateway Settings"}
          </span>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced && (
          <div className="border-t border-border p-5 space-y-4 bg-secondary/20">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isTamil
                ? "விருப்பப்பட்டால், உங்கள் தனிப்பயன் Twilio, Resend, Zapier அல்லது Make வெப்ஹூக் முகவரிகளை இங்கே உள்ளிடலாம்."
                : "Optionally specify custom webhook endpoints (Zapier, Make, Twilio, Resend, or your own backend) for dispatching notifications."}
            </p>

            <div className="space-y-2">
              <Label htmlFor="sms-webhook" className="text-xs">
                {isTamil ? "SMS Webhook URL" : "Custom SMS Webhook URL"}
              </Label>
              <Input
                id="sms-webhook"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={settings.smsWebhookUrl}
                onChange={(e) => updateSetting("smsWebhookUrl", e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-webhook" className="text-xs">
                {isTamil ? "மின்னஞ்சல் Webhook URL" : "Custom Email Webhook URL"}
              </Label>
              <Input
                id="email-webhook"
                placeholder="https://api.resend.com/emails or webhook endpoint"
                value={settings.emailWebhookUrl}
                onChange={(e) => updateSetting("emailWebhookUrl", e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-semibold">
                  {isTamil ? "தானியங்கி பின்னணி அறிவிப்பு (Automated Dispatch)" : "Automated Background Dispatch"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isTamil
                    ? "அனுமதி கேட்காமல் தானாகவே பின்னணியில் SMS மற்றும் மின்னஞ்சலை நேரடியாக அனுப்பும்."
                    : "Sends SMS and Email directly in the background without asking for manual user permission or confirmation."}
                </p>
              </div>
              <Switch
                checked={settings.autoDispatch}
                onCheckedChange={(val) => updateSetting("autoDispatch", val)}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
