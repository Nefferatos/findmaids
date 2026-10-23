"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { captureFirstTouch, getFirstTouch, trackAnonymousEvent } from "@/lib/attribution-client";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  messageId?: string;
  agencies?: {
    id: string;
    name: string;
    slug: string;
    city: string;
    province: string;
    services: string[];
    promoted: boolean;
    verifiedBadge: boolean;
  }[];
};
export function ChatWidget({ agencySlug }: { agencySlug?: string }) {
  const pathname = usePathname();
  const scopedAgencySlug =
    agencySlug ?? pathname.match(/^\/agencies\/([^/]+)$/)?.[1];
  const [enabled, setEnabled] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState<"en" | "fil" | "tl">("en");
  const [busy, setBusy] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  const [trackedOpen, setTrackedOpen] = useState(false);
  const [contact, setContact] = useState({
    agencyId: "",
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void fetch("/api/ai/chat")
      .then((response) => response.json())
      .then((data) => {
        setEnabled(data.enabled === true);
        setConversationId(data.conversationId ?? undefined);
        if (data.language) setLanguage(data.language);
        if (Array.isArray(data.messages))
          setLines(
            data.messages.map(
              (item: { id: string; role: string; content: string }) => ({
                id: crypto.randomUUID(),
                messageId: item.id,
                role: item.role === "USER" ? "user" : "assistant",
                text: item.content,
              }),
            ),
          );
        if (Array.isArray(data.messages))
          setLines(
            data.messages.map(
              (item: { id: string; role: string; content: string }) => ({
                id: `restored-${item.id}`,
                messageId: item.id,
                role: item.role === "USER" ? "user" : "assistant",
                text: item.content,
              }),
            ),
          );
      })
      .catch(() => setEnabled(false));
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, busy]);
  async function send(
    text = message,
    enquiry?: typeof contact,
    consent = false,
  ) {
    if (!text.trim() || busy) return;
    setLines((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
    ]);
    setMessage("");
    setBusy(true);
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        language,
        agencySlug: scopedAgencySlug,
        conversationId,
        consent,
        enquiry: enquiry?.agencyId
          ? { ...enquiry, acquisitionSource: getFirstTouch() }
          : undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      setLines((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error.error ?? "Chat is temporarily unavailable.",
        },
      ]);
      setBusy(false);
      return;
    }
    trackAnonymousEvent("CHAT_MESSAGE_SENT");
    const reader = response.body?.getReader();
    if (!reader) {
      setBusy(false);
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    const assistantId = crypto.randomUUID();
    setLines((current) => [
      ...current,
      { id: assistantId, role: "assistant", text: "" },
    ]);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const type = event.match(/^event: (.+)$/m)?.[1];
        const data = event.match(/^data: (.+)$/m)?.[1];
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (type === "meta") {
          if (parsed.conversationId) setConversationId(parsed.conversationId);
          setLines((current) =>
            current.map((line) =>
              line.id === assistantId
                ? {
                    ...line,
                    messageId: parsed.messageId,
                    agencies: parsed.agencies,
                  }
                : line,
            ),
          );
          if (parsed.enquiryReference)
            trackAnonymousEvent("CHAT_ENQUIRY_CREATED");
        } else if (type === "done" && parsed.messageId) {
          setLines((current) =>
            current.map((line) =>
              line.id === assistantId
                ? { ...line, messageId: parsed.messageId }
                : line,
            ),
          );
        } else if (type === "token") {
          setLines((current) =>
            current.map((line) =>
              line.id === assistantId
                ? { ...line, text: line.text + parsed.text }
                : line,
            ),
          );
        }
      }
    }
    setBusy(false);
  }
  async function feedback(line: ChatLine, rating: 1 | 5) {
    if (!line.messageId || line.text.length === 0) return;
    await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: line.messageId, rating }),
    });
  }
  if (!enabled) return null;
  return (
    <div className="fixed right-4 bottom-4 z-40">
      <button
        type="button"
        title="Open AI assistant"
        aria-label="Open AI assistant"
        onClick={() => setOpen((value) => {
          const next = !value;
          if (next && !trackedOpen) {
            const attribution = captureFirstTouch();
            if (attribution) {
              trackAnonymousEvent("CHAT_OPENED");
              setTrackedOpen(true);
            }
          }
          return next;
        })}
        className="bg-primary grid size-14 place-items-center rounded-full text-white shadow-lg"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>
      {open && (
        <section
          className="absolute right-0 bottom-16 flex h-[min(620px,calc(100dvh-110px))] w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border bg-white shadow-2xl"
          aria-label="FindMaids AI assistant"
        >
          <header className="border-b bg-[#f2f5ed] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display font-bold">FindMaids assistant</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  You&apos;re chatting with an AI assistant
                </p>
              </div>
              <select
                aria-label="Chat language"
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as typeof language)
                }
                className="min-h-8 rounded border bg-white px-2 text-xs"
              >
                <option value="en">English</option>
                <option value="fil">Filipino</option>
                <option value="tl">Taglish</option>
              </select>
            </div>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {lines.length === 0 && (
              <p className="rounded bg-[#f7f7f0] p-3 text-sm">
                Ask about approved agency listings, services, or how FindMaids
                works. I cannot provide legal or immigration advice.
              </p>
            )}
            {lines.map((line) => (
              <article
                key={line.id}
                className={`max-w-[90%] rounded-md p-3 text-sm ${line.role === "user" ? "bg-primary ml-auto text-white" : "bg-[#f2f5ed]"}`}
              >
                <p className="leading-6 whitespace-pre-wrap">
                  {line.text || " "}
                </p>
                {line.agencies?.map((agency) => (
                  <a
                    key={agency.id}
                    className="text-primary mt-2 block rounded border bg-white p-2"
                    href={`/agencies/${agency.slug}`}
                  >
                    <strong>{agency.name}</strong>
                    <span className="text-muted-foreground block text-xs">
                      {agency.city}, {agency.province} ·{" "}
                      {agency.services.join(", ")}
                    </span>
                    {agency.promoted && (
                      <span className="block text-xs font-bold">Sponsored</span>
                    )}
                  </a>
                ))}
                {line.role === "assistant" && line.text && (
                  <div className="mt-2 flex gap-2">
                    <button
                      aria-label="Helpful"
                      title="Helpful"
                      onClick={() => void feedback(line, 5)}
                    >
                      <ThumbsUp className="size-4" />
                    </button>
                    <button
                      aria-label="Not helpful"
                      title="Not helpful"
                      onClick={() => void feedback(line, 1)}
                    >
                      <ThumbsDown className="size-4" />
                    </button>
                  </div>
                )}
              </article>
            ))}
            {busy && (
              <p className="text-muted-foreground text-xs">
                Assistant is typing…
              </p>
            )}
          </div>
          {pendingConsent && (
            <form
              className="grid gap-2 border-t bg-white p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send(contact.message, contact, true);
                setPendingConsent(false);
              }}
            >
              <p className="text-xs">
                With your consent, these details will be sent to the selected
                agency so it can respond.
              </p>
              <select
                required
                aria-label="Agency"
                className="min-h-9 rounded border px-2 text-sm"
                value={contact.agencyId}
                onChange={(event) =>
                  setContact({ ...contact, agencyId: event.target.value })
                }
              >
                <option value="">Select agency</option>
                {lines
                  .flatMap((line) => line.agencies ?? [])
                  .filter(
                    (agency, index, array) =>
                      array.findIndex((item) => item.id === agency.id) ===
                      index,
                  )
                  .map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
              </select>
              <input
                required
                aria-label="Your name"
                placeholder="Name"
                className="min-h-9 rounded border px-2 text-sm"
                value={contact.name}
                onChange={(event) =>
                  setContact({ ...contact, name: event.target.value })
                }
              />
              <input
                required
                type="email"
                aria-label="Your email"
                placeholder="Email"
                className="min-h-9 rounded border px-2 text-sm"
                value={contact.email}
                onChange={(event) =>
                  setContact({ ...contact, email: event.target.value })
                }
              />
              <textarea
                required
                aria-label="Enquiry message"
                placeholder="What would you like to ask?"
                className="min-h-16 rounded border p-2 text-sm"
                value={contact.message}
                onChange={(event) =>
                  setContact({ ...contact, message: event.target.value })
                }
              />
              <label className="flex gap-2 text-xs">
                <input required type="checkbox" />I agree to share these details
                with the selected agency.
              </label>
              <button className="bg-primary min-h-9 rounded text-sm font-bold text-white">
                Send enquiry
              </button>
            </form>
          )}
          <footer className="flex gap-2 border-t p-3">
            <button
              type="button"
              title="Talk to a human"
              aria-label="Talk to a human"
              onClick={() => void send("Talk to a human, please.")}
              className="min-h-10 rounded border px-2 text-xs font-semibold"
            >
              Talk to a human
            </button>
            <button
              type="button"
              title="Share contact details with consent"
              aria-label="Share contact details with consent"
              onClick={() => setPendingConsent(true)}
              className="min-h-10 rounded border px-2 text-xs font-semibold"
            >
              Enquire
            </button>
            <form
              className="flex min-w-0 flex-1 gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="chat-message">
                Message
              </label>
              <input
                id="chat-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={3000}
                placeholder="Type a message"
                className="min-w-0 flex-1 rounded border px-2 text-sm"
              />
              <button
                aria-label="Send message"
                disabled={busy || !message.trim()}
                className="bg-primary grid size-10 place-items-center rounded text-white disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </form>
          </footer>
        </section>
      )}
    </div>
  );
}
