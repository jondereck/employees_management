"use client";

import * as React from "react";

import { useToolsNavigation } from "./navigation-provider";

export type ToolNavigationLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export const ToolNavigationLink = React.forwardRef<HTMLAnchorElement, ToolNavigationLinkProps>(
  ({ href, onClick, target, rel, ...props }, ref) => {
    const { navigate } = useToolsNavigation();

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          (target && target !== "_self") ||
          event.metaKey ||
          event.altKey ||
          event.ctrlKey ||
          event.shiftKey
        ) {
          return;
        }

        event.preventDefault();
        navigate(href);
      },
      [href, navigate, onClick, target]
    );

    return (
      <a
        {...props}
        ref={ref}
        href={href}
        onClick={handleClick}
        target={target}
        rel={rel}
      />
    );
  }
);

ToolNavigationLink.displayName = "ToolNavigationLink";
