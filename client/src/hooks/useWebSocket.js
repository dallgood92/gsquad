import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const WEBSOCKET_URL =
  import.meta.env
    .VITE_WEBSOCKET_URL ||
  "ws://localhost:3001";

const INITIAL_RECONNECT_DELAY =
  1000;

const MAX_RECONNECT_DELAY =
  30000;

function useWebSocket(
  enabled,
  onEvent
) {
  const socketRef =
    useRef(null);

  const reconnectTimeoutRef =
    useRef(null);

  const reconnectAttemptRef =
    useRef(0);

  const [connected, setConnected] =
    useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    function scheduleReconnect() {
      if (cancelled) {
        return;
      }

      const attempt =
        reconnectAttemptRef.current;

      const delay =
        Math.min(
          INITIAL_RECONNECT_DELAY *
            2 ** attempt,
          MAX_RECONNECT_DELAY
        );

      reconnectAttemptRef.current +=
        1;

      console.log(
        `WebSocket reconnecting in ${delay}ms`
      );

      reconnectTimeoutRef.current =
        setTimeout(() => {
          connect();
        }, delay);
    }

    function connect() {
      if (cancelled) {
        return;
      }

      if (
        socketRef.current &&
        (
          socketRef.current
            .readyState ===
            WebSocket.OPEN ||
          socketRef.current
            .readyState ===
            WebSocket.CONNECTING
        )
      ) {
        return;
      }

      const socket =
        new WebSocket(
          WEBSOCKET_URL
        );

      socketRef.current =
        socket;

      socket.addEventListener(
        "open",
        () => {
          console.log(
            "WebSocket connection opened"
          );

          reconnectAttemptRef.current =
            0;
        }
      );

      socket.addEventListener(
        "message",
        (event) => {
          try {
            const message =
              JSON.parse(
                event.data
              );

            if (
              message.type ===
              "connection_ready"
            ) {
              setConnected(
                true
              );

              reconnectAttemptRef.current =
                0;
            }

            onEvent?.(
              message
            );
          } catch (error) {
            console.error(
              "Failed to parse WebSocket message:",
              error
            );
          }
        }
      );

      socket.addEventListener(
        "close",
        () => {
          console.log(
            "WebSocket connection closed"
          );

          setConnected(
            false
          );

          if (
            socketRef.current ===
            socket
          ) {
            socketRef.current =
              null;
          }

          scheduleReconnect();
        }
      );

      socket.addEventListener(
        "error",
        (error) => {
          console.error(
            "WebSocket error:",
            error
          );
        }
      );
    }

    connect();

    return () => {
      cancelled = true;

      setConnected(false);

      if (
        reconnectTimeoutRef.current
      ) {
        clearTimeout(
          reconnectTimeoutRef.current
        );

        reconnectTimeoutRef.current =
          null;
      }

      const socket =
        socketRef.current;

      socketRef.current =
        null;

      if (socket) {
        socket.close();
      }
    };
  }, [
    enabled,
    onEvent,
  ]);

  const sendEvent =
    useCallback(
      (type, data) => {
        const socket =
          socketRef.current;

        if (!socket) {
          return;
        }

        if (
          socket.readyState !==
          WebSocket.OPEN
        ) {
          return;
        }

        socket.send(
          JSON.stringify({
            type,
            data,
          })
        );
      },
      []
    );

  return {
    connected,
    sendEvent,
  };
}

export default useWebSocket;