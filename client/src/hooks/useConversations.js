import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createConversation as createConversationRequest,
  getConversations,
  getMessages,
  markConversationRead as markConversationReadRequest,
  sendMessage as sendMessageRequest,
} from "../services/api";

function mergeMessages(
  ...messageGroups
) {
  const messagesById =
    new Map();

  for (
    const messages of messageGroups
  ) {
    for (
      const message of messages
    ) {
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

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    messagesLoading,
    setMessagesLoading,
  ] = useState(false);

  const [
    olderMessagesLoading,
    setOlderMessagesLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

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
      setError(null);

      return;
    }

    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);

        const data =
          await getConversations();

        const conversationsWithMessageState =
          data.map(
            (conversation) => ({
              ...conversation,

              messages: [],

              messagesLoaded:
                false,

              hasMoreMessages:
                false,

              nextMessageCursor:
                null,

              unreadCount:
                conversation.unreadCount ??
                0,

              lastMessage:
                conversation.lastMessage ??
                null,
            })
          );

        const sortedConversations =
          sortConversations(
            conversationsWithMessageState
          );

        setConversations(
          sortedConversations
        );

        if (
          sortedConversations.length >
          0
        ) {
          setSelectedConversationId(
            sortedConversations[0].id
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

        setError(
          error.message
        );
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, [currentUserId]);

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

                    unreadCount:
                      0,

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

    if (
      !selectedConversationId
    ) {
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
          conversation.messages
            .length - 1
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
        setMessagesLoading(
          true
        );

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

                  messagesLoaded:
                    true,

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
            data.messages.length -
              1
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

        setError(
          error.message
        );
      } finally {
        setMessagesLoading(
          false
        );
      }
    }

    loadMessages();
  }, [
    currentUserId,
    selectedConversationId,
    markConversationRead,
  ]);

  const selectConversation = (
    conversationId
  ) => {
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

            hasMoreMessages:
              false,

            nextMessageCursor:
              null,

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

        setSelectedConversationId(
          newConversation.id
        );
      } catch (error) {
        console.error(
          "Failed to create conversation:",
          error
        );

        setError(
          error.message
        );
      }
    };

  const addMemberToConversation =
    (membership) => {
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

                messagesLoaded:
                  false,

                hasMoreMessages:
                  false,

                nextMessageCursor:
                  null,

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

                  return {
                    ...conversation,

                    messages:
                      mergeMessages(
                        conversation.messages,
                        [newMessage]
                      ),

                    lastMessage:
                      newMessage,

                    unreadCount:
                      isSelectedConversation
                        ? 0
                        : conversation.unreadCount +
                          1,
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

  const loadOlderMessages =
    async () => {
      if (
        !selectedConversation
      ) {
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

      if (
        olderMessagesLoading
      ) {
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

        setError(
          error.message
        );

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

        setError(
          error.message
        );
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
    loadOlderMessages,
    startTyping,
    stopTyping,
    sendMessage,
    loading,
    messagesLoading,
    olderMessagesLoading,
    error,
  };
}

export default useConversations;