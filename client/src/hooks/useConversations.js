import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createConversation as createConversationRequest,
  getConversations,
  sendMessage as sendMessageRequest,
} from "../services/api";

function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] =
    useState(null);

  const [typingUsers, setTypingUsers] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoading(true);
        setError(null);

        const data = await getConversations();

        setConversations(data);

        if (data.length > 0) {
          setSelectedConversationId(data[0].id);
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

  const selectedConversation = conversations.find(
    (conversation) =>
      conversation.id === selectedConversationId
  );

  const selectedTypingUsers =
    typingUsers[selectedConversationId] || [];

  const selectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  const createConversation = async (name) => {
    if (!name.trim()) {
      return;
    }

    try {
      setError(null);

      const newConversation =
        await createConversationRequest(name);

      setConversations((currentConversations) => [
        ...currentConversations,
        newConversation,
      ]);

      setSelectedConversationId(newConversation.id);
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error
      );

      setError(error.message);
    }
  };

  const addMemberToConversation = (membership) => {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) => {
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
      })
    );
  };

  const receiveConversation = useCallback(
    (newConversation) => {
      setConversations((currentConversations) => {
        const conversationAlreadyExists =
          currentConversations.some(
            (conversation) =>
              conversation.id === newConversation.id
          );

        if (conversationAlreadyExists) {
          return currentConversations;
        }

        return [
          ...currentConversations,
          newConversation,
        ];
      });
    },
    []
  );

  const receiveMessage = useCallback((newMessage) => {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) => {
        if (
          conversation.id ===
          newMessage.conversationId
        ) {
          const messageAlreadyExists =
            conversation.messages.some(
              (message) =>
                message.id === newMessage.id
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

        return conversation;
      })
    );
  }, []);

  const startTyping = useCallback(
    (conversationId, userId) => {
      setTypingUsers((currentTypingUsers) => {
        const conversationTypingUsers =
          currentTypingUsers[conversationId] || [];

        if (conversationTypingUsers.includes(userId)) {
          return currentTypingUsers;
        }

        return {
          ...currentTypingUsers,
          [conversationId]: [
            ...conversationTypingUsers,
            userId,
          ],
        };
      });
    },
    []
  );

  const stopTyping = useCallback(
    (conversationId, userId) => {
      setTypingUsers((currentTypingUsers) => {
        const conversationTypingUsers =
          currentTypingUsers[conversationId] || [];

        return {
          ...currentTypingUsers,
          [conversationId]:
            conversationTypingUsers.filter(
              (typingUserId) =>
                typingUserId !== userId
            ),
        };
      });
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

      const newMessage = await sendMessageRequest(
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
    startTyping,
    stopTyping,
    sendMessage,
    loading,
    error,
  };
}

export default useConversations;