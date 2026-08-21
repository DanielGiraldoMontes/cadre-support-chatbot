"use client";

import { useState, type FormEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 border-t border-black/10 bg-cadre-background p-4 dark:border-white/10"
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <input
        id="chat-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask about Cadre's services, industries, or getting started..."
        disabled={disabled}
        autoComplete="off"
        className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-foreground outline-none focus:border-cadre-primary disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-full bg-cadre-primary px-5 py-2.5 text-sm font-medium text-cadre-primary-foreground transition-opacity disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
