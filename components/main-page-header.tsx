"use client";

import type { ReactNode } from "react";
import { Breadcrumb, BreadcrumbList } from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type MainPageHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function MainPageHeader({ children, className }: MainPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear",
        className,
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Breadcrumb>
        <BreadcrumbList>{children}</BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
