import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { uploadMessageAttachment } from "../services/api";

function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  replyToMessage,
  onCancelReply,
  draftKey,
  conversationId,
}) {
  const storageKey = `message-draft:${draftKey}`;
  const [message, setMessage] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentError, setAttachmentError] = useState("");

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const chooseAttachment = async (file) => {
    if (!file) return;
    setAttachmentError("");
    const previewUrl = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith("video/") ? "video" : "img");
    media.preload = "metadata";
    media.onloadedmetadata = media.onload = () => {
      setAttachment({ file, previewUrl, metadata: {
        width: media.videoWidth || media.naturalWidth || null,
        height: media.videoHeight || media.naturalHeight || null,
        duration: Number.isFinite(media.duration) ? media.duration : null,
      } });
    };
    media.onerror = () => setAttachment({ file, previewUrl, metadata: {} });
    media.src = previewUrl;
  };

  const removeAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [message]);

  const stopTyping = () => {
    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;

    onTypingStop?.();
  };

  const handleChange = (event) => {
    const value = event.target.value;

    setMessage(value);
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);

    if (!value.trim()) {
      clearTimeout(typingTimeoutRef.current);
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;

      onTypingStart?.();
    }

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!message.trim() && !attachment) {
      return;
    }

    clearTimeout(typingTimeoutRef.current);
    stopTyping();

    try {
      setSending(true);
      let uploadedAttachment = null;
      if (attachment) {
        uploadedAttachment = await uploadMessageAttachment(conversationId, attachment.file, attachment.metadata, setUploadProgress);
        uploadedAttachment.previewUrl = attachment.previewUrl;
      }
      const sentMessage = await onSendMessage(message, replyToMessage?.id ?? null, uploadedAttachment);
      if (sentMessage) {
        setMessage("");
        removeAttachment();
        localStorage.removeItem(storageKey);
        onCancelReply?.();
      }
    } catch (error) {
      setAttachmentError(error.message || "The attachment could not be sent");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  return (
    <div className="message-composer">
      {replyToMessage && (
        <div className="reply-composer-preview">
          <span>
            Replying to {replyToMessage.sender.name}: {replyToMessage.text}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply">×</button>
        </div>
      )}
      {attachment && <div className="attachment-composer-preview">
        {attachment.file.type.startsWith("video/") ? <video src={attachment.previewUrl} muted /> : <img src={attachment.previewUrl} alt="Attachment preview" />}
        <span><strong>{attachment.file.name}</strong><small>{uploadProgress ? `Uploading ${uploadProgress}%` : `${(attachment.file.size / 1024 / 1024).toFixed(1)} MB`}</small></span>
        <button type="button" disabled={sending} onClick={removeAttachment} aria-label="Remove attachment">×</button>
      </div>}
      {attachmentError && <div className="attachment-error" role="status">{attachmentError}</div>}
    <form
      className="message-input"
      onSubmit={handleSubmit}
    >
      <input ref={fileInputRef} className="attachment-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(event) => chooseAttachment(event.target.files?.[0])} />
      <button className="attachment-button" type="button" disabled={sending || Boolean(attachment)} onClick={() => fileInputRef.current?.click()} aria-label="Add photo or video" title="Add photo or video">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form.requestSubmit();
          }
        }}
        placeholder="Type a message..."
        maxLength={2000}
        rows={1}
        disabled={sending}
      />

      <span className="draft-status">{message ? `Draft · ${message.length}/2000` : ""}</span>

      <button className="send-button" type="submit" disabled={sending || (!message.trim() && !attachment)}>
        {sending ? "Sending..." : "Send"}
      </button>
    </form>
    </div>
  );
}

export default MessageInput;
