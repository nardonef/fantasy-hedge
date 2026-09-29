"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/connect", label: "Connect" },
  { href: "/markets", label: "Markets" },
  { href: "/wallet", label: "Wallet" },
];

export function NavLinks({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const links = admin ? [...LINKS, { href: "/admin/settlements", label: "Admin" }] : LINKS;

  return (
    <>
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "font-semibold text-chalk" : "text-chalk-faint hover:text-chalk"}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
