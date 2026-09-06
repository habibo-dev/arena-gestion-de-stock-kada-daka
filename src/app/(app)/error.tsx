"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState title="Cette page n'a pas pu être chargée" description={error.message || "Une erreur inattendue s'est produite. Réessayez ou contactez l'administrateur si le problème persiste."} retry={reset} />;
}
