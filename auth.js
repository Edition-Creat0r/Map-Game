// MAP GAME - Supabase Authentication

const SUPABASE_URL = "https://vjwvhtsjdsbcorszzldk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_bDQFgJtpYdOmwgUoSr_JCA_37U9AE6D";

const MAP_GAME_URL =
  "https://edition-creat0r.github.io/Map-Game/";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

window.mapGameAuth = {
  async signUp(email, password, username) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: MAP_GAME_URL,
        data: {
          username: username
        }
      }
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signIn(email, password) {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async getCurrentUser() {
    const {
      data: { user },
      error
    } = await supabaseClient.auth.getUser();

    if (error) {
      return null;
    }

    return user;
  },

  async resetPassword(email) {
    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: MAP_GAME_URL
      });

    if (error) {
      throw error;
    }
  },

  async updatePassword(newPassword) {
    const { data, error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      throw error;
    }

    return data;
  },

  onAuthChange(callback) {
    return supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );
  }
};