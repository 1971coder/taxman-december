import { GstCodesCard } from "../../components/forms/gst-codes-card";
import { SettingsForm } from "../../components/forms/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsForm />
      <GstCodesCard />
    </div>
  );
}
