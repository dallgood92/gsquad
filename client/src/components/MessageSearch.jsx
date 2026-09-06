import { useEffect, useRef, useState } from "react";
import { searchMessages } from "../services/api";

function MessageSearch({ onSelectResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

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

  return (
    <div className="message-search">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search messages..."
        aria-label="Search messages"
      />
      {query.trim().length >= 2 && (
        <div className="search-results">
          <div className="search-results-header"><strong>Search results</strong><button type="button" onClick={close}>×</button></div>
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
              <span><strong>{message.conversation.name}</strong> · {message.sender.name}</span>
              <span>{message.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MessageSearch;
