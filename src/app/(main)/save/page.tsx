import { Suspense } from "react";
import { Loader } from "@/components/ui/Loader";
import { SaveFlow } from "@/components/card/SaveFlow";

export default function SavePage() {
  return (
    <Suspense fallback={<Loader fullPage={true} />}>
      <SaveFlow />
    </Suspense>
  );
}