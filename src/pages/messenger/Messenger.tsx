/**
 * File: src/pages/messenger/Messenger.tsx
 * Messenger — "Chat with us" live support, wired to the real backend.
 *
 * Backend (single support conversation per app user, /api/v1/live-chat):
 *   GET  /live-chat/me           → { conversation, messages }
 *   POST /live-chat/me/messages  { text } → { message, autoReply|null }
 *   POST /live-chat/me/read      → clears my unread badge
 *
 * There is one conversation per user (company ↔ Qayd Support). A scripted bot
 * answers the first two messages, then a human agent takes over. Messages from
 * "user" render on the right (green), "admin"/"bot" render on the left.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Globe,
  MessageCircle,
  Search,
  Smile,
  Paperclip,
  Send,
  User,
  Check,
  CheckCheck,
  Loader2,
  Bot,
  Headphones,
} from "lucide-react";
import { api } from "@/lib/api/client";

// ─── Types (match backend serializers) ─────────────────────────────────────────

type ChatSender = "user" | "admin" | "bot";

interface ChatMessage {
  _id: string;
  conversation_id: string;
  sender: ChatSender;
  senderUser_id: string | null;
  text: string;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt?: string;
}

interface ChatConversation {
  _id: string;
  user_id: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastSender: ChatSender | null;
  unreadForUser: number;
  status: "open" | "closed";
}

interface ThreadResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

interface SendResponse {
  message: ChatMessage;
  autoReply: ChatMessage | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const truncate = (s: string, n = 26) =>
  s.length > n ? s.slice(0, n) + "..." : s;

const fmtTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "";

const SUPPORT_NAME = "Qayd Support";

// Circular avatar for the support contact.
const SupportAvatar: React.FC<{ size?: number; online?: boolean }> = ({
  size = 42,
  online = true,
}) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    <div
      className="w-full h-full rounded-full flex items-center justify-center text-white bg-emerald-500"
      style={{ fontSize: size * 0.4 }}
    >
      <Headphones style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
    {online && (
      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
    )}
  </div>
);

// Left-side (admin/bot) message avatar.
const SenderIcon: React.FC<{ sender: ChatSender }> = ({ sender }) =>
  sender === "bot" ? (
    <Bot className="w-4 h-4 text-emerald-500" />
  ) : (
    <Headphones className="w-4 h-4 text-emerald-500" />
  );

// ─── Main Component ───────────────────────────────────────────────────────────

export const Messenger: React.FC = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(true);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load my support thread on mount.
  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ThreadResponse>("/live-chat/me");
      setConversation(data.conversation);
      setMessages(data.messages ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Mark my unread messages as read once the thread is open with unread items.
  const markRead = useCallback(async () => {
    if (!conversation || conversation.unreadForUser <= 0) return;
    try {
      await api.post("/live-chat/me/read");
      setConversation((c) => (c ? { ...c, unreadForUser: 0 } : c));
      setMessages((prev) => prev.map((m) => ({ ...m, readByUser: true })));
    } catch {
      /* non-fatal */
    }
  }, [conversation]);

  useEffect(() => {
    if (open && conversation && conversation.unreadForUser > 0) markRead();
  }, [open, conversation, markRead]);

  // Scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText("");
    try {
      const res = await api.post<SendResponse>("/live-chat/me/messages", {
        text,
      });
      setMessages((prev) => {
        const next = [...prev, res.message];
        if (res.autoReply) next.push(res.autoReply);
        return next;
      });
      setConversation((c) =>
        c
          ? {
              ...c,
              lastMessageText: res.autoReply?.text ?? res.message.text,
              lastMessageAt:
                res.autoReply?.createdAt ?? res.message.createdAt ?? null,
              lastSender: res.autoReply ? "bot" : "user",
            }
          : c,
      );
    } catch (e: any) {
      setError(e?.message || "Failed to send message.");
      setInputText(text); // restore so the user doesn't lose their text
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // The one support conversation, shown in the left list (filtered by search).
  const matchesSearch = SUPPORT_NAME.toLowerCase().includes(
    search.trim().toLowerCase(),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFBFC]">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Messenger</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
          <Globe className="w-4 h-4" />
          <span>en English</span>
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Messenger</h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex p-4 gap-4">
        {/* ── Left Sidebar ── */}
        <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 flex items-center gap-2 border-b border-gray-100">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">
              Conversations
            </span>
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
              <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Conversation list — the single "Chat with us" support thread */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-xs">Loading…</p>
              </div>
            ) : !matchesSearch ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">
                  No conversations found
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Try adjusting your search
                </p>
              </div>
            ) : (
              <button
                onClick={() => setOpen(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${
                  open
                    ? "bg-gray-50 border-l-emerald-500"
                    : "border-l-transparent hover:bg-gray-50"
                }`}
              >
                <SupportAvatar size={40} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {SUPPORT_NAME}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                      <span className="text-[11px] text-gray-400">
                        {fmtTime(conversation?.lastMessageAt)}
                      </span>
                      {conversation && conversation.unreadForUser > 0 && (
                        <span className="min-w-5 h-5 px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {conversation.unreadForUser}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {conversation?.lastMessageText
                      ? truncate(conversation.lastMessageText)
                      : "Chat with our support team"}
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
          {!open ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-9 h-9 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Select a conversation
              </h3>
              <p className="text-sm text-gray-400">
                Choose a conversation from the list to start messaging
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 flex-shrink-0">
                <SupportAvatar size={42} />
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {SUPPORT_NAME}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    We typically reply within a few minutes
                  </p>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-sm text-red-500 mb-3">{error}</p>
                    <button
                      onClick={loadThread}
                      className="text-sm text-emerald-600 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                      <MessageCircle className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      Start the conversation
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Send a message and our team will get back to you.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const sent = msg.sender === "user";
                    return (
                      <div
                        key={msg._id}
                        className={`flex items-end gap-2 ${sent ? "justify-end" : "justify-start"}`}
                      >
                        {!sent && (
                          <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <SenderIcon sender={msg.sender} />
                          </div>
                        )}
                        <div
                          className={`max-w-xs lg:max-w-sm xl:max-w-md rounded-2xl px-4 py-2.5 ${
                            sent
                              ? "bg-emerald-500 text-white rounded-br-md"
                              : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {!sent && (
                            <p className="text-[11px] font-semibold text-emerald-600 mb-0.5">
                              {msg.sender === "bot"
                                ? "Qayd Bot"
                                : "Support Agent"}
                            </p>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 ${sent ? "text-emerald-100" : "text-gray-400"}`}
                          >
                            <span className="text-[11px]">
                              {fmtTime(msg.createdAt)}
                            </span>
                            {sent &&
                              (msg.readByAdmin ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={loading || sending}
                  className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 disabled:opacity-60"
                />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || sending}
                    className="w-9 h-9 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messenger;
