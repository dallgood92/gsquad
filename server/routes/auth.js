const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();

module.exports = function createAuthRoutes(prisma) {
  const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const production = process.env.NODE_ENV === "production";
  const sessionCookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  router.post("/google", async (req, res) => {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({
          error: "Google credential is required",
        });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      let user = await prisma.user.findUnique({
        where: {
          googleId: payload.sub,
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            avatarUrl: payload.picture,
          },
        });

        const generalConversation =
          await prisma.conversation.findFirst({
            where: {
              name: "General",
            },
          });

        if (generalConversation) {
          await prisma.conversationMember.create({
            data: {
              userId: user.id,
              conversationId: generalConversation.id,
            },
          });
        }
      }

      const token = jwt.sign(
        {
          userId: user.id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      res.cookie("session", token, sessionCookie);

      res.json({
        user,
      });
    } catch (error) {
      console.error("Google authentication failed:", error);

      res.status(401).json({
        error: "Invalid Google credential",
      });
    }
  });

  router.get("/me", async (req, res) => {
    try {
      const token = req.cookies.session;

      if (!token) {
        return res.status(401).json({
          error: "Not authenticated",
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await prisma.user.findUnique({
        where: {
          id: decoded.userId,
        },
      });

      if (!user) {
        return res.status(401).json({
          error: "User not found",
        });
      }

      res.json({
        user,
      });
    } catch (error) {
      console.error("Failed to get current user:", error);

      res.status(401).json({
        error: "Invalid session",
      });
    }
  });

  router.post("/logout", (req, res) => {
    res.clearCookie("session", {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
    });

    res.json({
      message: "Logged out successfully",
    });
  });

  return router;
};
