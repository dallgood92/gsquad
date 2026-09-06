import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createConversation as createConversationRequest,
  deleteMessage as deleteMessageRequest,
  getConversations,
  getMessages,
  markConversationRead as markConversationReadRequest,
  sendMessage as sendMessageRequest,
  updateMessage as updateMessageRequest,
} from "../services/api";

function mergeMessages(
  ...messageGroups
) {
  const messagesById =
    new Map();

  for (const messages of messageGroups) {
    for (const message of messages) {
      messagesById.set(
        message.id,
        message
      );
    }
  }

  return Array.from(
    messagesById.values()
  ).sort(
    (
      firstMessage,
      secondMessage
    ) =>
      firstMessage.id -
      secondMessage.id
  );
}

function sortConversations(
  conversations
) {
  return [...conversations].sort(
    (
      firstConversation,
      secondConversation
    ) => {
      const firstActivity =
        firstConversation
          .lastMessage?.id ?? 0;

      const secondActivity =
        secondConversation
          .lastMessage?.id ?? 0;

      if (
        firstActivity ===
        secondActivity
      ) {
        return (
          secondConversation.id -
          firstConversation.id
        );
      }

      return (
        secondActivity -
        firstActivity
      );
    }
  );
}

function replaceMessageInConversation(
  conversation,
  updatedMessage
) {
  const messages =
    conversation.messages.map(
      (message) =>
        message.id ===
        updatedMessage.id
          ? updatedMessage
          : message
    );

  const lastMessage =
    conversation.lastMessage?.id ===
    updatedMessage.id
      ? updatedMessage
      : conversation.lastMessage;

  return {
    ...conversation,
    messages,
    lastMessage,
  };
}

function useConversations(
  currentUserId
) {
  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState(null);

  const [
    typingUsers,
    setTypingUsers,
  ] = useState({});

  const [loading, setLoading] =
    useState(false);

  const [
    messagesLoading,
    setMessagesLoading,
  ] = useState(false);

  const [
    olderMessagesLoading,
    setOlderMessagesLoading,
  ] = useState(false);

  const [syncing, setSyncing] =
    useState(false);

  const [error, setError] =
    useState(null);

  const conversationsRef =
    useRef([]);

  const selectedConversationIdRef =
    useRef(null);

  useEffect(() => {
    conversationsRef.current =
      conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current =
      selectedConversationId;
  }, [selectedConversationId]);

  const normalizeConversations =
    useCallback(
      (
        serverConversations,
        existingConversations = []
      ) => {
        return sortConversations(
          serverConversations.map(
            (conversation) => {
              const existing =
                existingConversations.find(
                  (
                    currentConversation
                  ) =>
                    currentConversation.id ===
                    conversation.id
                );

              return {
                ...conversation,

                messages:
                  existing?.messages ??
                  [],

                messagesLoaded:
                  existing
                    ?.messagesLoaded ??
                  false,

                hasMoreMessages:
                  existing
                    ?.hasMoreMessages ??
                  false,

                nextMessageCursor:
                  existing
                    ?.nextMessageCursor ??
                  null,

                unreadCount:
                  conversation.unreadCount ??
                  0,

                lastMessage:
                  conversation.lastMessage ??
                  null,
              };
            }
          )
        );
      },
      []
    );

  const loadConversations =
    useCallback(
      async () => {
        if (!currentUserId) {
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const data =
            await getConversations();

          const normalized =
            normalizeConversations(
              data
            );

          setConversations(
            normalized
          );

          if (
            normalized.length > 0
          ) {
            setSelectedConversationId(
              (
                currentSelectedId
              ) => {
                const stillExists =
                  normalized.some(
                    (
                      conversation
                    ) =>
                      conversation.id ===
                      currentSelectedId
                  );

                if (stillExists) {
                  return currentSelectedId;
                }

                return normalized[0]
                  .id;
              }
            );
          } else {
            setSelectedConversationId(
              null
            );
          }
        } catch (error) {
          console.error(
            "Failed to load conversations:",
            error
          );

          setError(error.message);
        } finally {
          setLoading(false);
        }
      },
      [
        currentUserId,
        normalizeConversations,
      ]
    );

  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setSelectedConversationId(
        null
      );
      setTypingUsers({});
      setLoading(false);
      setMessagesLoading(false);
      setOlderMessagesLoading(
        false
      );
      setSyncing(false);
      setError(null);

      return;
    }

    loadConversations();
  }, [
    currentUserId,
    loadConversations,
  ]);

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id ===
        selectedConversationId
    );

  const selectedTypingUsers =
    typingUsers[
      selectedConversationId
    ] || [];

  const markConversationRead =
    useCallback(
      async (
        conversationId,
        messageId
      ) => {
        if (!currentUserId) {
          return;
        }

        if (!messageId) {
          return;
        }

        try {
          const membership =
            await markConversationReadRequest(
              conversationId,
              messageId
            );

          setConversations(
            (
              currentConversations
            ) =>
              currentConversations.map(
                (
                  conversation
                ) => {
                  if (
                    conversation.id !==
                    conversationId
                  ) {
                    return conversation;
                  }

                  return {
                    ...conversation,

                    unreadCount: 0,

                    members:
                      conversation.members.map(
                        (
                          currentMembership
                        ) => {
                          if (
                            currentMembership.userId !==
                            currentUserId
                          ) {
                            return currentMembership;
                          }

                          return {
                            ...currentMembership,

                            lastReadMessageId:
                              membership.lastReadMessageId,
                          };
                        }
                      ),
                  };
                }
              )
          );
        } catch (error) {
          console.error(
            "Failed to mark conversation read:",
            error
          );
        }
      },
      [currentUserId]
    );

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    if (!selectedConversationId) {
      return;
    }

    const conversation =
      conversationsRef.current.find(
        (conversation) =>
          conversation.id ===
          selectedConversationId
      );

    if (!conversation) {
      return;
    }

    if (
      conversation.messagesLoaded
    ) {
      const lastMessage =
        conversation.messages[
          conversation.messages.length -
            1
        ];

      if (lastMessage) {
        markConversationRead(
          conversation.id,
          lastMessage.id
        );
      }

      return;
    }

    async function loadMessages() {
      try {
        setMessagesLoading(true);
        setError(null);

        const conversationId =
          selectedConversationId;

        const data =
          await getMessages(
            conversationId
          );

        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) => {
                if (
                  conversation.id !==
                  conversationId
                ) {
                  return conversation;
                }

                return {
                  ...conversation,

                  messages:
                    mergeMessages(
                      data.messages,
                      conversation.messages
                    ),

                  messagesLoaded: true,

                  hasMoreMessages:
                    data.hasMore,

                  nextMessageCursor:
                    data.nextCursor,

                  unreadCount: 0,
                };
              }
            )
        );

        const lastMessage =
          data.messages[
            data.messages.length - 1
          ];

        if (lastMessage) {
          await markConversationRead(
            conversationId,
            lastMessage.id
          );
        }
      } catch (error) {
        console.error(
          "Failed to load messages:",
          error
        );

        setError(error.message);
      } finally {
        setMessagesLoading(false);
      }
    }

    loadMessages();
  }, [
    currentUserId,
    selectedConversationId,
    markConversationRead,
  ]);

  const resync =
    useCallback(async () => {
      if (!currentUserId) {
        return;
      }

      try {
        setSyncing(true);

        const serverConversations =
          await getConversations();

        const selectedId =
          selectedConversationIdRef.current;

        let selectedMessagesData =
          null;

        if (selectedId) {
          selectedMessagesData =
            await getMessages(
              selectedId
            );
        }

        setConversations(
          (
            currentConversations
          ) => {
            const normalized =
              normalizeConversations(
                serverConversations,
                currentConversations
              );

            return normalized.map(
              (conversation) => {
                if (
                  conversation.id !==
                    selectedId ||
                  !selectedMessagesData
                ) {
                  return conversation;
                }

                return {
                  ...conversation,

                  messages:
                    mergeMessages(
                      conversation.messages,
                      selectedMessagesData.messages
                    ),

                  messagesLoaded: true,

                  hasMoreMessages:
                    selectedMessagesData.hasMore,

                  nextMessageCursor:
                    selectedMessagesData.nextCursor,

                  unreadCount: 0,
                };
              }
            );
          }
        );

        const latestMessage =
          selectedMessagesData
            ?.messages[
              selectedMessagesData
                .messages.length - 1
            ];

        if (
          selectedId &&
          latestMessage
        ) {
          await markConversationRead(
            selectedId,
            latestMessage.id
          );
        }
      } catch (error) {
        console.error(
          "Failed to resync conversations:",
          error
        );
      } finally {
        setSyncing(false);
      }
    }, [
      currentUserId,
      normalizeConversations,
      markConversationRead,
    ]);

  const selectConversation = (
    conversationId
  ) => {
    selectedConversationIdRef.current =
      conversationId;

    setSelectedConversationId(
      conversationId
    );
  };

  const createConversation =
    async (name) => {
      if (!name.trim()) {
        return;
      }

      try {
        setError(null);

        const newConversation =
          await createConversationRequest(
            name
          );

        const conversationWithMessageState =
          {
            ...newConversation,

            messages: [],
            messagesLoaded: true,
            hasMoreMessages: false,
            nextMessageCursor: null,
            unreadCount: 0,
            lastMessage: null,
          };

        setConversations(
          (
            currentConversations
          ) =>
            sortConversations([
              ...currentConversations,
              conversationWithMessageState,
            ])
        );

        selectedConversationIdRef.current =
          newConversation.id;

        setSelectedConversationId(
          newConversation.id
        );
      } catch (error) {
        console.error(
          "Failed to create conversation:",
          error
        );

        setError(error.message);
      }
    };

  const addMemberToConversation = (
    membership
  ) => {
    setConversations(
      (
        currentConversations
      ) =>
        currentConversations.map(
          (conversation) => {
            if (
              conversation.id ===
              membership.conversationId
            ) {
              return {
                ...conversation,

                members: [
                  ...conversation.members,
                  membership,
                ],
              };
            }

            return conversation;
          }
        )
    );
  };

  const receiveConversation =
    useCallback(
      (newConversation) => {
        setConversations(
          (
            currentConversations
          ) => {
            const conversationAlreadyExists =
              currentConversations.some(
                (
                  conversation
                ) =>
                  conversation.id ===
                  newConversation.id
              );

            if (
              conversationAlreadyExists
            ) {
              return currentConversations;
            }

            return sortConversations([
              ...currentConversations,

              {
                ...newConversation,

                messages: [],
                messagesLoaded: false,
                hasMoreMessages: false,
                nextMessageCursor: null,

                unreadCount:
                  newConversation.unreadCount ??
                  0,

                lastMessage:
                  newConversation.lastMessage ??
                  null,
              },
            ]);
          }
        );
      },
      []
    );

  const receiveMessage =
    useCallback(
      (newMessage) => {
        const isSelectedConversation =
          selectedConversationIdRef.current ===
          newMessage.conversationId;

        setConversations(
          (
            currentConversations
          ) => {
            const updatedConversations =
              currentConversations.map(
                (conversation) => {
                  if (
                    conversation.id !==
                    newMessage.conversationId
                  ) {
                    return conversation;
                  }

                  const messageAlreadyExists =
                    conversation.messages.some(
                      (message) =>
                        message.id ===
                        newMessage.id
                    );

                  return {
                    ...conversation,

                    messages:
                      messageAlreadyExists
                        ? conversation.messages
                        : mergeMessages(
                            conversation.messages,
                            [
                              newMessage,
                            ]
                          ),

                    lastMessage:
                      newMessage,

                    unreadCount:
                      isSelectedConversation
                        ? 0
                        : messageAlreadyExists
                          ? conversation.unreadCount
                          : (
                              conversation.unreadCount ??
                              0
                            ) + 1,
                  };
                }
              );

            return sortConversations(
              updatedConversations
            );
          }
        );

        if (
          isSelectedConversation
        ) {
          markConversationRead(
            newMessage.conversationId,
            newMessage.id
          );
        }
      },
      [markConversationRead]
    );

  const receiveMessageUpdate =
    useCallback(
      (updatedMessage) => {
        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) => {
                if (
                  conversation.id !==
                  updatedMessage.conversationId
                ) {
                  return conversation;
                }

                return replaceMessageInConversation(
                  conversation,
                  updatedMessage
                );
              }
            )
        );
      },
      []
    );

  const receiveMessageDelete =
    useCallback(
      (deletedMessage) => {
        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) => {
                if (
                  conversation.id !==
                  deletedMessage.conversationId
                ) {
                  return conversation;
                }

                return replaceMessageInConversation(
                  conversation,
                  deletedMessage
                );
              }
            )
        );
      },
      []
    );

  const editMessage =
    async (
      messageId,
      text
    ) => {
      if (
        !selectedConversationId
      ) {
        return false;
      }

      if (!text.trim()) {
        return false;
      }

      try {
        setError(null);

        const updatedMessage =
          await updateMessageRequest(
            selectedConversationId,
            messageId,
            text
          );

        receiveMessageUpdate(
          updatedMessage
        );

        return true;
      } catch (error) {
        console.error(
          "Failed to edit message:",
          error
        );

        setError(error.message);

        return false;
      }
    };

  const deleteMessage =
    async (messageId) => {
      if (
        !selectedConversationId
      ) {
        return false;
      }

      try {
        setError(null);

        const deletedMessage =
          await deleteMessageRequest(
            selectedConversationId,
            messageId
          );

        receiveMessageDelete(
          deletedMessage
        );

        return true;
      } catch (error) {
        console.error(
          "Failed to delete message:",
          error
        );

        setError(error.message);

        return false;
      }
    };

  const loadOlderMessages =
    async () => {
      if (!selectedConversation) {
        return false;
      }

      if (
        !selectedConversation
          .hasMoreMessages
      ) {
        return false;
      }

      if (
        !selectedConversation
          .nextMessageCursor
      ) {
        return false;
      }

      if (olderMessagesLoading) {
        return false;
      }

      try {
        setOlderMessagesLoading(
          true
        );

        setError(null);

        const conversationId =
          selectedConversation.id;

        const cursor =
          selectedConversation
            .nextMessageCursor;

        const data =
          await getMessages(
            conversationId,
            cursor
          );

        setConversations(
          (
            currentConversations
          ) =>
            currentConversations.map(
              (conversation) => {
                if (
                  conversation.id !==
                  conversationId
                ) {
                  return conversation;
                }

                return {
                  ...conversation,

                  messages:
                    mergeMessages(
                      data.messages,
                      conversation.messages
                    ),

                  hasMoreMessages:
                    data.hasMore,

                  nextMessageCursor:
                    data.nextCursor,
                };
              }
            )
        );

        return true;
      } catch (error) {
        console.error(
          "Failed to load older messages:",
          error
        );

        setError(error.message);

        return false;
      } finally {
        setOlderMessagesLoading(
          false
        );
      }
    };

  const startTyping =
    useCallback(
      (
        conversationId,
        userId
      ) => {
        setTypingUsers(
          (
            currentTypingUsers
          ) => {
            const conversationTypingUsers =
              currentTypingUsers[
                conversationId
              ] || [];

            if (
              conversationTypingUsers.includes(
                userId
              )
            ) {
              return currentTypingUsers;
            }

            return {
              ...currentTypingUsers,

              [conversationId]: [
                ...conversationTypingUsers,
                userId,
              ],
            };
          }
        );
      },
      []
    );

  const stopTyping =
    useCallback(
      (
        conversationId,
        userId
      ) => {
        setTypingUsers(
          (
            currentTypingUsers
          ) => {
            const conversationTypingUsers =
              currentTypingUsers[
                conversationId
              ] || [];

            return {
              ...currentTypingUsers,

              [conversationId]:
                conversationTypingUsers.filter(
                  (
                    typingUserId
                  ) =>
                    typingUserId !==
                    userId
                ),
            };
          }
        );
      },
      []
    );

  const sendMessage =
    async (text) => {
      if (!text.trim()) {
        return;
      }

      if (
        !selectedConversationId
      ) {
        return;
      }

      try {
        setError(null);

        const newMessage =
          await sendMessageRequest(
            selectedConversationId,
            {
              text,
            }
          );

        receiveMessage(
          newMessage
        );
      } catch (error) {
        console.error(
          "Failed to send message:",
          error
        );

        setError(error.message);
      }
    };

  return {
    conversations,
    selectedConversation,
    selectedConversationId,
    selectedTypingUsers,

    selectConversation,
    createConversation,
    addMemberToConversation,

    receiveConversation,
    receiveMessage,
    receiveMessageUpdate,
    receiveMessageDelete,

    editMessage,
    deleteMessage,

    loadOlderMessages,

    startTyping,
    stopTyping,

    sendMessage,

    resync,

    loading,
    messagesLoading,
    olderMessagesLoading,
    syncing,
    error,
  };
}

export default useConversations;