import { useEffect, useRef } from "react";
import { loginWithGoogle } from "../services/api";

function GoogleLogin({ onLogin }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!window.google) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,

      callback: async (response) => {
        try {
          const data = await loginWithGoogle(response.credential);

          onLogin(data.user);
        } catch (error) {
          console.error("Login failed:", error);
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
    });
  }, [onLogin]);

  return <div ref={buttonRef} />;
}

export default GoogleLogin;