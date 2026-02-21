"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  Loader2,
  Bot,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatMessage, type ChatMessage } from "@/lib/api";

interface ChatPanelProps {
  runId?: string;
  className?: string;
}

interface DisplayMessage extends ChatMessage {
  id: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "How can I optimize this workflow?",
  "Are there steps that could run in parallel?",
  "How can I reduce token costs?",
  "What error handling improvements do you suggest?",
];

export function ChatPanel({ runId, className }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = text || input.trim();
      if (!content || isLoading) return;

      const userMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        // Build message history for context (last 10 messages)
        const history: ChatMessage[] = [...messages, userMsg]
          .slice(-10)
          .map(({ role, content }) => ({ role, content }));

        const response = await sendChatMessage(history, runId);

        const assistantMsg: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ Failed to get a response. Please check that the API server is running.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, runId]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700",
          "text-white",
          className
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col",
        "w-[420px] h-[600px] max-h-[80vh]",
        "rounded-xl border bg-background shadow-2xl",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Workflow Advisor</h3>
            <p className="text-xs text-muted-foreground">
              Powered by Claude
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {runId && (
            <Badge variant="outline" className="text-xs">
              Run active
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-6">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">
                  Workflow Optimization Advisor
                </p>
                <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                  Ask me how to optimize your agentic workflows — I&apos;ll analyze
                  steps, costs, latency, and suggest improvements.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className={cn(
                      "text-left text-xs px-3 py-2 rounded-lg border",
                      "hover:bg-accent hover:border-accent-foreground/20",
                      "transition-colors"
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                  <User className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about workflow optimization..."
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-lg border bg-background px-3 py-2",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "max-h-24"
            )}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!input.trim() || isLoading}
            onClick={() => handleSend()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
