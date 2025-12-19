"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CreateCardModal } from "@/components/card/CreateCardModal";
import { createClient } from "@/lib/supabase/client";
import { Loader } from "@/components/ui/Loader";

export function SaveFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const url = searchParams?.get("url");
  const fileParam = searchParams?.get("file");

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setIsChecking(false);

      if (!user) {
        router.push("/");
      }
    };
    checkAuth();
  }, [router]);

  const handleClose = () => {
    router.push("/");
  };

  let initialFileData = null;
  if (fileParam) {
    try {
      initialFileData = JSON.parse(decodeURIComponent(fileParam));
    } catch (e) {
      console.error("Failed to parse file data:", e);
    }
  }

  if (isChecking) {
    return <Loader fullPage={true} />;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen">
      <CreateCardModal
        isOpen={true}
        onClose={handleClose}
        initialUrl={url || undefined}
        initialFileData={initialFileData || undefined}
      />
    </div>
  );
}