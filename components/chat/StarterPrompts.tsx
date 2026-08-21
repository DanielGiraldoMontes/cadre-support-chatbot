import { STARTER_PROMPTS } from "@/lib/chat/types";

interface Props {
  onSelect: (text: string) => void;
}

export function StarterPrompts({ onSelect }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {STARTER_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-cadre-primary transition-colors hover:bg-black/[.03] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
