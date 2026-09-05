import {
  useCallback,
  useState,
} from "react";

function usePresence() {
  const [onlineUserIds, setOnlineUserIds] =
    useState([]);

  const setInitialPresence = useCallback(
    (userIds) => {
      setOnlineUserIds(userIds);
    },
    []
  );

  const setUserOnline = useCallback((userId) => {
    setOnlineUserIds((currentUserIds) => {
      if (currentUserIds.includes(userId)) {
        return currentUserIds;
      }

      return [
        ...currentUserIds,
        userId,
      ];
    });
  }, []);

  const setUserOffline = useCallback((userId) => {
    setOnlineUserIds((currentUserIds) =>
      currentUserIds.filter(
        (onlineUserId) =>
          onlineUserId !== userId
      )
    );
  }, []);

  const isUserOnline = useCallback(
    (userId) => {
      return onlineUserIds.includes(userId);
    },
    [onlineUserIds]
  );

  return {
    onlineUserIds,
    setInitialPresence,
    setUserOnline,
    setUserOffline,
    isUserOnline,
  };
}

export default usePresence;