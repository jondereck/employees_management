"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ToolsMenuLink = {
  key: string;
  href: string;
  label: string;
  description: string;
  active: boolean;
  icon: React.ReactNode;
};

type ToolsMenuProps = {
  links: ToolsMenuLink[];
  activeRoute?: ToolsMenuLink;
  onNavigate: (href: string) => void;
  isActive?: boolean;
  homeLink?: {
    href: string;
    label: string;
    description: string;
  };
};

export function ToolsMenu({ links, activeRoute, onNavigate, isActive, homeLink }: ToolsMenuProps) {
  const [open, setOpen] = React.useState(false);

  const handleNavigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      onNavigate(href);
    },
    [onNavigate]
  );

  if (links.length === 0 && !homeLink) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-300",
            activeRoute || isActive
              ? "border-green-600 text-green-700"
              : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600"
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="text-base">Tools</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="z-70 w-[360px] space-y-2 p-4"
      >
        {homeLink && (
          <button
            type="button"
            onClick={() => handleNavigate(homeLink.href)}
            className={cn(
              "flex w-full flex-col items-start gap-1 rounded-md border bg-emerald-50 p-4 text-left transition-colors duration-200 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              isActive && !activeRoute ? "border-emerald-300 ring-1 ring-emerald-400" : "border-emerald-200"
            )}
          >
            <span className="text-base font-semibold text-emerald-900">{homeLink.label}</span>
            <span className="text-sm text-emerald-900/80">{homeLink.description}</span>
          </button>
        )}
        {links.map((link) => (
          <button
            key={link.href}
            type="button"
            onClick={() => handleNavigate(link.href)}
            className={cn(
              "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              link.active ? "border-primary" : "border-border"
            )}
          >
            <span className="mt-1 text-muted-foreground" aria-hidden="true">
              {link.icon}
            </span>
            <span className="space-y-1">
              <span className="block font-medium leading-tight text-foreground">
                {link.label}
              </span>
              <span className="block text-sm text-muted-foreground">
                {link.description}
              </span>
            </span>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
