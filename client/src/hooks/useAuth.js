import { useEffect, useState } from "react";
import { getCurrentUser, logoutUser } from "../services/api";

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to check authentication:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = (authenticatedUser) => {
    setUser(authenticatedUser);
  };

  const logout = async () => {
  try {
    await logoutUser();
    setUser(null);
  } catch (error) {
    console.error("Failed to logout:", error);
  }
};

  return {
    user,
    loading,
    login,
    logout,
  };
}

export default useAuth;