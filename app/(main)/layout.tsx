import { MainLayoutClient } from "@/app/(main)/main-layout-client";
import {
  getUserConversations,
  getUserWebSearchThreads,
} from "@/lib/server/app-data";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [initialConversations, initialThreads] = await Promise.all([
    getUserConversations(),
    getUserWebSearchThreads(),
  ]);

  return (
    <MainLayoutClient
      initialConversations={initialConversations}
      initialThreads={initialThreads}
    >
      {children}
    </MainLayoutClient>
  );
}
