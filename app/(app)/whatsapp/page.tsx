import { Suspense } from "react";
import { WhatsAppWorkspace } from "@/features/communications/whatsapp-workspace";
import { LoadingState } from "@/components/ui/loading-state";

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WhatsAppWorkspace />
    </Suspense>
  );
}
