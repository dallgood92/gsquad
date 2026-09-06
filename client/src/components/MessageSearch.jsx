import { useCallback, useEffect, useRef, useState } from "react";
import { searchMessages } from "../services/api";
import useClickOutside from "../hooks/useClickOutside";
import Avatar from "./Avatar";

function formatSearchTime(createdAt) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(createdAt));
}

function MessageSearch({ onSelectResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const rootRef = useRef(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const requestId = ++requestIdRef.current;

    if (trimmedQuery.length < 2) return;

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await searchMessages(trimmedQuery);
        if (requestId === requestIdRef.current) setResults(data.messages);
      } catch (requestError) {
        if (requestId === requestIdRef.current) setError(requestError.message);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const close = () => {
    setQuery("");
    setResults([]);
    setError(null);
  };
  const dismiss = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);
  useClickOutside(rootRef, dismiss, query.trim().length >= 2);

  return (
    <div className="message-search" ref={rootRef}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search messages..."
        aria-label="Search messages"
      />
      {query.trim().length >= 2 && (
        <div className="search-results">
          <div className="search-results-header"><span><strong>Messages</strong><small>{!loading && !error ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "Search results"}</small></span></div>
          {loading && <p>Searching...</p>}
          {error && <p>{error}</p>}
          {!loading && !error && results.length === 0 && <p>No messages found.</p>}
          {results.map((message) => (
            <button
              type="button"
              className="search-result"
              key={message.id}
              onClick={() => { onSelectResult(message); close(); }}
            >
              <Avatar user={message.sender} size="small" />
              <span className="search-result-copy"><span><strong>{message.sender.name}</strong><small>{message.conversation.name} · {formatSearchTime(message.createdAt)}</small></span><span>{message.text}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageSearch;
