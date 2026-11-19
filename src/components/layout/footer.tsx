import { Camera, CirclePlay, Globe, GraduationCap } from "lucide-react";
import Link from "next/link";
import { site } from "@/config/site";

function FooterBrand() {
  return (
    <div>
      <Link className="inline-flex items-center gap-2 text-lg font-semibold text-white" href="/">
        <GraduationCap aria-hidden="true" size={24} />
        {site.name}
      </Link>
      <p className="mt-4 max-w-xs text-sm leading-6 text-white/85">
        {site.tagline}
      </p>
      <div aria-label="Media sosial" className="mt-4 flex items-center gap-4 text-white">
        <span aria-label="Instagram">
          <Camera aria-hidden="true" size={18} />
        </span>
        <span aria-label="YouTube">
          <CirclePlay aria-hidden="true" size={19} />
        </span>
        <span aria-label="Situs web">
          <Globe aria-hidden="true" size={18} />
        </span>
      </div>
    </div>
  );
}

function FooterLinkList({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              className="text-sm text-white/85 transition hover:text-white"
              href={link.href}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterContact() {
  const { contact } = site;

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-white">Kontak</h2>
      <div className="space-y-3 text-sm text-white/85">
        <p>{contact.address}</p>
        <p>Telepon: {contact.telephone}</p>
        <p>WhatsApp: {contact.whatsapp}</p>
        <p>{contact.email}</p>
        <p>{contact.hours}</p>
      </div>
      <a
        className="mt-5 inline-flex min-h-11 w-full max-w-52 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-light"
        href={`mailto:${contact.email}`}
      >
        Hubungi Panitia
      </a>
    </div>
  );
}

function FooterColumns() {
  return (
    <>
      <FooterBrand />
      <FooterLinkList title="Tautan Cepat" links={site.quickLinks} />
      <FooterLinkList title="Portal" links={site.portals} />
      <FooterContact />
    </>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto bg-dark text-white">
      <div className="mx-auto max-w-[1440px] px-6 py-10 sm:px-8 lg:px-9 lg:py-12">
        <div className="hidden grid-cols-4 gap-8 lg:grid lg:gap-12">
          <FooterColumns />
        </div>
        <div className="space-y-1 lg:hidden">
          <FooterBrand />
          <details className="group border-b border-white/15 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              Tautan Cepat
              <span className="float-right transition group-open:rotate-180">⌄</span>
            </summary>
            <ul className="mt-4 space-y-3">
              {site.quickLinks.map((link) => (
                <li key={link.label}>
                  <Link className="text-sm text-white/85" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details className="group border-b border-white/15 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              Portal
              <span className="float-right transition group-open:rotate-180">⌄</span>
            </summary>
            <ul className="mt-4 space-y-3">
              {site.portals.map((link) => (
                <li key={link.label}>
                  <Link className="text-sm text-white/85" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details className="group border-b border-white/15 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              Kontak
              <span className="float-right transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4">
              <FooterContact />
            </div>
          </details>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-white/15 pt-4 text-xs text-white/85 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2025 SMK Citra Negara</p>
          <p>Kebijakan Privasi · Syarat · Bantuan</p>
          <p className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-light" />
            Sistem Online
          </p>
        </div>
      </div>
    </footer>
  );
}
