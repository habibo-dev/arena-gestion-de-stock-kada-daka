import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page introuvable"
      description="L'élément demandé n'existe pas ou a été supprimé."
      action={
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Retour au tableau de bord
        </Link>
      }
    />
  );
}
