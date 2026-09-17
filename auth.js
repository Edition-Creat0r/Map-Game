// ============================================================
// MAP GAME — auth.js
// Supabase email/password authentication
// Browser-safe public credentials only.
// ============================================================

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://vjwvhtsjdsbcorszzldk.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_bDQFgJtpYdOmwgUoSr_JCA_37U9AE6D";

  const MAP_GAME_URL =
    "https://edition-creat0r.github.io/Map-Game/";

  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "Map Game auth: Supabase library did not load."
    );
    return;
  }

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  function isVerified(user) {
    return Boolean(
      user &&
      (
        user.email_confirmed_at ||
        user.confirmed_at
      )
    );
  }

  window.mapGameAuth = {
    client,

    isVerified,

    async signUp(
      email,
      password,
      username
    ) {
      const {
        data,
        error
      } =
        await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              MAP_GAME_URL,
            data: {
              username
            }
          }
        });

      if (error) {
        throw error;
      }

      return data;
    },

    async signIn(
      email,
      password
    ) {
      const {
        data,
        error
      } =
        await client.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        throw error;
      }

      return data;
    },

    async signOut() {
      const {
        error
      } =
        await client.auth.signOut();

      if (error) {
        throw error;
      }
    },

    async getCurrentUser() {
      const {
        data,
        error
      } =
        await client.auth.getUser();

      if (error) {
        return null;
      }

      return data.user || null;
    },

    async refreshUser() {
      const {
        data,
        error
      } =
        await client.auth.getUser();

      if (error) {
        throw error;
      }

      return data.user || null;
    },

    async resendVerification(email) {
      const {
        data,
        error
      } =
        await client.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo:
              MAP_GAME_URL
          }
        });

      if (error) {
        throw error;
      }

      return data;
    },

    async resetPassword(email) {
      const {
        data,
        error
      } =
        await client.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              MAP_GAME_URL
          }
        );

      if (error) {
        throw error;
      }

      return data;
    },

    async updatePassword(
      newPassword
    ) {
      const {
        data,
        error
      } =
        await client.auth.updateUser({
          password:
            newPassword
        });

      if (error) {
        throw error;
      }

      return data;
    },

    onAuthChange(callback) {
      return client.auth.onAuthStateChange(
        (
          event,
          session
        ) => {
          callback(
            event,
            session
          );
        }
      );
    }
  };

  console.log(
    "Map Game auth ready."
  );
})();
