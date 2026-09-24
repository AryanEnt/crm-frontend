import { Suspense } from "react";
import { EmailSettingsView } from "@/features/email/email-settings-view";
import { LoadingState } from "@/components/ui/loading-state";

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EmailSettingsView />
    </Suspense>
  );
}
