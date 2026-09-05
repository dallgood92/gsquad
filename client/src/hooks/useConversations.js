import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createConversation as createConversationRequest,
  getConversations,
  getMessages,
  sendMessage as sendMessageRequest,
} from "../services/api";

function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] =
    useState(null);

  const [typingUsers, setTypingUsers] = useState({});

  const [loading, setLoading] = useState(true);

  const [messagesLoading, setMessagesLoading] =
    useState(false);

  const [olderMessagesLoading, setOlderMessagesLoading] =
    useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);

        const data = await getConversations();

        const conversationsWithMessageState = data.map(
          (conversation) => ({
            ...conversation,
            messages: [],
            messagesLoaded: false,
            hasMoreMessages: false,
            nextMessageCursor: null,
          })
        );

        setConversations(
          conversationsWithMessageState
        );

        if (data.length > 0) {
          setSelectedConversationId(
            data[0].id
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
    }

    loadConversations();
  }, []);

  const selectedConversation =
    conversations.find(
      (conversation) =>
        conversation.id ===
        selectedConversationId
    );

  const selectedTypingUsers =
    typingUsers[selectedConversationId] || [];

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const conversation = conversations.find(
      (conversation) =>
        conversation.id ===
        selectedConversationId
    );

    if (!conversation) {
      return;
    }

    if (conversation.messagesLoaded) {
      return;
    }

    async function loadMessages() {
      try {
        setMessagesLoading(true);
        setError(null);

        const data = await getMessages(
          selectedConversationId
        );

        setConversations(
          (currentConversations) =>
            currentConversations.map(
              (conversation) => {
                if (
                  conversation.id ===
                  selectedConversationId
                ) {
                  return {
                    ...conversation,
                    messages: data.messages,
                    messagesLoaded: true,
                    hasMoreMessages:
                      data.hasMore,
                    nextMessageCursor:
                      data.nextCursor,
                  };
                }

                return conversation;
              }
            )
        );
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
    selectedConversationId,
    conversations,
  ]);

  const selectConversation = (
    conversationId
  ) => {
    setSelectedConversationId(
      conversationId
    );
  };

  const createConversation = async (name) => {
    if (!name.trim()) {
      return;
    }

    try {
      setError(null);

      const newConversation =
        await createConversationRequest(name);

      const conversationWithMessageState = {
        ...newConversation,
        messages: [],
        messagesLoaded: true,
        hasMoreMessages: false,
        nextMessageCursor: null,
      };

      setConversations(
        (currentConversations) => [
          ...currentConversations,
          conversationWithMessageState,
        ]
      );

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
      (currentConversations) =>
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

  const receiveConversation = useCallback(
    (newConversation) => {
      setConversations(
        (currentConversations) => {
          const conversationAlreadyExists =
            currentConversations.some(
              (conversation) =>
                conversation.id ===
                newConversation.id
            );

          if (conversationAlreadyExists) {
            return currentConversations;
          }

          return [
            ...currentConversations,
            {
              ...newConversation,
              messages: [],
              messagesLoaded: false,
              hasMoreMessages: false,
              nextMessageCursor: null,
            },
          ];
        }
      );
    },
    []
  );

  const receiveMessage = useCallback(
    (newMessage) => {
      setConversations(
        (currentConversations) =>
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

              if (messageAlreadyExists) {
                return conversation;
              }

              return {
                ...conversation,

                messages: [
                  ...conversation.messages,
                  newMessage,
                ],
              };
            }
          )
      );
    },
    []
  );

  const loadOlderMessages = async () => {
    if (!selectedConversation) {
      return;
    }

    if (
      !selectedConversation.hasMoreMessages
    ) {
      return;
    }

    if (
      !selectedConversation.nextMessageCursor
    ) {
      return;
    }

    if (olderMessagesLoading) {
      return;
    }

    try {
      setOlderMessagesLoading(true);
      setError(null);

      const conversationId =
        selectedConversation.id;

      const data = await getMessages(
        conversationId,
        selectedConversation.nextMessageCursor
      );

      setConversations(
        (currentConversations) =>
          currentConversations.map(
            (conversation) => {
              if (
                conversation.id !==
                conversationId
              ) {
                return conversation;
              }

              const existingMessageIds =
                new Set(
                  conversation.messages.map(
                    (message) => message.id
                  )
                );

              const olderMessages =
                data.messages.filter(
                  (message) =>
                    !existingMessageIds.has(
                      message.id
                    )
                );

              return {
                ...conversation,

                messages: [
                  ...olderMessages,
                  ...conversation.messages,
                ],

                hasMoreMessages:
                  data.hasMore,

                nextMessageCursor:
                  data.nextCursor,
              };
            }
          )
      );
    } catch (error) {
      console.error(
        "Failed to load older messages:",
        error
      );

      setError(error.message);
    } finally {
      setOlderMessagesLoading(false);
    }
  };

  const startTyping = useCallback(
    (conversationId, userId) => {
      setTypingUsers(
        (currentTypingUsers) => {
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

  const stopTyping = useCallback(
    (conversationId, userId) => {
      setTypingUsers(
        (currentTypingUsers) => {
          const conversationTypingUsers =
            currentTypingUsers[
              conversationId
            ] || [];

          return {
            ...currentTypingUsers,

            [conversationId]:
              conversationTypingUsers.filter(
                (typingUserId) =>
                  typingUserId !== userId
              ),
          };
        }
      );
    },
    []
  );

  const sendMessage = async (text) => {
    if (!text.trim()) {
      return;
    }

    if (!selectedConversationId) {
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

      receiveMessage(newMessage);
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