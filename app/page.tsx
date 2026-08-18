import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center bg-cadre-background">
      <header className="w-full max-w-2xl px-4 pt-6 text-center sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-cadre-primary">
          Cadre AI Support
        </h1>
        <p className="mt-1 text-sm text-cadre-muted">From AI Confusion to AI Confidence.</p>
      </header>
      <ChatContainer />
    </div>
  );
}
