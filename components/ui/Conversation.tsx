
import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Types ---
interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode; }
interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode; }
interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> { title?: string; description?: string; icon?: React.ReactNode; }
interface ConversationScrollButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

interface ConversationContextType {
  scrollRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
  isAtBottom: boolean;
  showScrollButton: boolean;
}

const ConversationContext = React.createContext<ConversationContextType | undefined>(undefined);
const useConversation = () => {
  const context = React.useContext(ConversationContext);
  if (!context) throw new Error('useConversation must be used within a Conversation component');
  return context;
};

export const Conversation: React.FC<ConversationProps> = ({ children, className, ...props }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      setIsAtBottom(true);
      setShowScrollButton(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(isBottom);
      setShowScrollButton(!isBottom && scrollHeight > clientHeight);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const observer = new MutationObserver(() => {
        const currentScrollHeight = scrollRef.current?.scrollHeight || 0;
        if (currentScrollHeight !== contentHeight) {
            setContentHeight(currentScrollHeight);
            if (isAtBottom) setTimeout(scrollToBottom, 50); 
        }
      });
      observer.observe(scrollRef.current, { childList: true, subtree: true, characterData: true });
      return () => observer.disconnect();
    }
  }, [contentHeight, isAtBottom, scrollToBottom]);

  useEffect(() => { scrollToBottom(); }, []);

  return (
    <ConversationContext.Provider value={{ scrollRef, scrollToBottom, isAtBottom, showScrollButton }}>
      <div className={`relative flex flex-col h-full overflow-hidden ${className || ''}`} {...props}>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-4">
            {children}
        </div>
      </div>
    </ConversationContext.Provider>
  );
};

export const ConversationContent: React.FC<ConversationContentProps> = ({ children, className, ...props }) => (
  <div className={`flex flex-col gap-4 ${className || ''}`} {...props}>{children}</div>
);

export const ConversationEmptyState: React.FC<ConversationEmptyStateProps> = ({ title = "No messages yet", description = "Start a conversation", icon, className, children, ...props }) => (
  <div className={`flex flex-col items-center justify-center h-full text-center p-8 text-slate-500 dark:text-slate-400 ${className || ''}`} {...props}>
    {children ? children : <>{icon && <div className="mb-4 text-4xl">{icon}</div>}<h3 className="font-bold text-lg mb-2">{title}</h3><p className="text-sm opacity-80">{description}</p></>}
  </div>
);

export const ConversationScrollButton: React.FC<ConversationScrollButtonProps> = ({ className, ...props }) => {
  const { scrollToBottom, showScrollButton } = useConversation();
  if (!showScrollButton) return null;
  return (
    <button onClick={(e) => { e.preventDefault(); scrollToBottom(); props.onClick?.(e as any); }} className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-lg rounded-full p-2 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all z-10 animate-bounce-in ${className || ''}`} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  );
};
