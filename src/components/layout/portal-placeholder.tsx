import { Footer } from "@/components/layout/footer";
import { PublicHeader } from "@/components/layout/public-header";

export function PortalPlaceholder() {
  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center bg-green-50 px-4 py-16">
        <h1 className="text-center text-3xl font-bold text-ink sm:text-4xl">
          Segera hadir
        </h1>
      </main>
      <Footer />
    </>
  );
}
