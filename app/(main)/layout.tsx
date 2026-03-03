"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useConversations } from "@/hooks/use-conversations";
import { useRouter } from "next/navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { conversations, createConversation, deleteConversation } =
    useConversations();

  const handleNewChat = async () => {
    const convo = await createConversation();
    router.push(`/chat/${convo.id}`);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    // If we are on the deleted chat page, we might want to redirect.
    // Ideally we check params but useParams might not be available here or complex.
    // For now, simple delete is fine. The user is redirected in the page component if needed, 
    // or we can let the user stay on a 404/empty page. 
    // Actually, the Page component handles "if (convoId === id) router.push('/chat')" 
    // But since the delete trigger is now in the sidebar (Layout), the layout doesn't easily know the current page ID.
    // We can just redirect to /chat if the current URL contains the ID.
    if (window.location.pathname.includes(id)) {
        router.push("/chat");
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar
        conversations={conversations}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
      />
      <SidebarInset className="h-screen overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
