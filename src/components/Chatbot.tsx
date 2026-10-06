import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hi! I'm Dikhyant's AI assistant. How can I help you?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessages(prev => [...prev, { role: "ai", content: data.text }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", content: "Sorry, I ran into an error." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I couldn't connect." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-[#c1121f] text-white shadow-lg shadow-[#c1121f]/25 hover:bg-[#a01019] transition-colors ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[400px] h-[500px] max-h-[80vh] flex flex-col bg-[#0a0a0b] border border-[#efece4]/12 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#efece4]/10 bg-[#101012]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#c1121f]/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-[#c1121f]" />
                </div>
                <div>
                  <h3 className="text-[#efece4] font-medium">Ask about the work</h3>
                  <p className="text-xs text-[#8b877d]">Online</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="p-2 rounded-full hover:bg-white/5 text-[#8b877d] hover:text-[#efece4] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.role === "user" 
                        ? "bg-[#c1121f] text-white rounded-tr-sm"
                        : "bg-[#efece4]/[0.06] text-[#dedad2] rounded-tl-sm border border-[#efece4]/8"
                    }`}
                  >
                    {msg.role === "ai" ? (
                      <div className="markdown-body prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#efece4]/[0.06] border border-[#efece4]/8 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#c1121f] animate-spin" />
                    <span className="text-xs text-[#8b877d]">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[#efece4]/10 bg-[#101012]">
              <div className="relative flex items-center">
                <label htmlFor="chat-input" className="sr-only">
                  Ask a question
                </label>
                <input
                  id="chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the work…"
                  className="w-full bg-[#0a0a0b] border border-[#efece4]/12 rounded-full py-3 pl-4 pr-12 text-sm text-[#efece4] placeholder-[#56534d] focus:outline-none focus:border-[#c1121f]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c1121f] transition-colors"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 rounded-full text-[#c1121f] hover:bg-[#c1121f]/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
