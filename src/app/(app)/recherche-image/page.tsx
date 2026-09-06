import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { getVisionStatus } from "@/server/vision";
import { PageHeader } from "@/components/ui/misc";
import { ImageSearch } from "@/components/search/image-search";

export const metadata: Metadata = { title: "Recherche par image" };

export default async function ImageSearchPage() {
  await requirePermission("parts.view");
  const status = await getVisionStatus();
  return (
    <>
      <PageHeader title="Recherche par image" description="Photographiez l'étiquette ou la gravure d'une pièce : le texte est lu, les références extraites puis recherchées dans votre stock." />
      <ImageSearch provider={{ label: status.label, mode: status.mode, available: status.available }} />
    </>
  );
}
