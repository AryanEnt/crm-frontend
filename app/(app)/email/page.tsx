import { Suspense } from "react";
import { EmailWorkspace } from "@/features/email/email-workspace";
import { LoadingState } from "@/components/ui/loading-state";

export default function EmailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EmailWorkspace />
    </Suspense>
  );
}
