import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const WEBSOCKET_URL =
  import.meta.env.VITE_WEBSOCKET_URL ||
  "ws://localhost:3001";

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

function getReconnectDelay(
  attempt
) {
  const exponentialDelay =
    Math.min(
      INITIAL_RECONNECT_DELAY *
        2 ** attempt,
      MAX_RECONNECT_DELAY
    );

  const jitter =
    Math.random() *
    exponentialDelay *
    0.25;

  return Math.round(
    exponentialDelay + jitter
  );
}

function useWebSocket(
  enabled,
  onEvent,
  onReconnect
) {
  const socketRef =
    useRef(null);

  const reconnectTimeoutRef =
    useRef(null);

  const reconnectAttemptRef =
    useRef(0);

  const hasConnectedRef =
    useRef(false);

  const [status, setStatus] =
    useState("disconnected");

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
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
        getReconnectDelay(
          attempt
        );

      reconnectAttemptRef.current +=
        1;

      setStatus("reconnecting");

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

      setStatus(
        hasConnectedRef.current
          ? "reconnecting"
          : "connecting"
      );

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
            "WebSocket transport opened"
          );
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
              const wasReconnect =
                hasConnectedRef.current;

              hasConnectedRef.current =
                true;

              reconnectAttemptRef.current =
                0;

              setStatus("connected");

              if (wasReconnect) {
                onReconnect?.();
              }
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

      setStatus("disconnected");

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
    onReconnect,
  ]);

  const sendEvent =
    useCallback(
      (type, data) => {
        const socket =
          socketRef.current;

        if (!socket) {
          return false;
        }

        if (
          socket.readyState !==
          WebSocket.OPEN
        ) {
          return false;
        }

        socket.send(
          JSON.stringify({
            type,
            data,
          })
        );

        return true;
      },
      []
    );

  return {
    connected:
      status === "connected",

    status,

    sendEvent,
  };
}

export default useWebSocket;