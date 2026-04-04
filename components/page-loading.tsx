"use client";

import { BreadcrumbItem } from "@/components/ui/breadcrumb";
import { MainPageHeader } from "@/components/main-page-header";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingHeader() {
  return (
    <MainPageHeader>
      <BreadcrumbItem>
        <Skeleton className="h-4 w-24" />
      </BreadcrumbItem>
    </MainPageHeader>
  );
}

export function ChatPageLoading() {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <LoadingHeader />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            <div className="flex max-w-[78%] flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-20 w-full rounded-3xl" />
            </div>
            <div className="ml-auto flex w-[72%] flex-col gap-2">
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="h-28 w-full rounded-3xl" />
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t bg-background p-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex gap-2 px-1">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <Skeleton className="h-32 w-full rounded-[28px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeGridPageLoading() {
  return (
    <div className="flex flex-col h-full">
      <LoadingHeader />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="flex h-[180px] min-w-[180px] flex-col justify-between rounded-xl border p-6"
            >
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="size-14 rounded-2xl" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KnowledgeDetailPageLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LoadingHeader />
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-48 shrink-0 border-r p-3">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-8 w-[88%] rounded-lg" />
              <Skeleton className="h-8 w-[76%] rounded-lg" />
              <Skeleton className="h-8 w-[68%] rounded-lg" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="min-w-[180px] rounded-xl border p-4"
                >
                  <div className="flex flex-col items-center gap-4">
                    <Skeleton className="size-16 rounded-2xl" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex w-full items-center justify-between gap-2">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
