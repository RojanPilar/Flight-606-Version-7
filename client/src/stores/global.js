import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';
import { getProfile } from '../api.js';

export const useGlobalStore = defineStore('global', () => {

    let user = reactive({
        token: localStorage.getItem('token'),
        email: null,
        // Read directly from localStorage on load so the navbar doesn't flicker/misbehave
        isAdmin: localStorage.getItem('isAdmin') === 'true' 
    });

    // Thin convenience getter over user.isAdmin — use this in route guards /
    // templates instead of reaching into user.isAdmin directly. Does not
    // duplicate state, just exposes it; user.isAdmin stays the source of truth.
    const isAdmin = computed(() => user.isAdmin === true);

    async function getUserDetails(token) {
        if (!token) {
            user.token = null;
            user.email = null;
            user.firstName = null;
            user.isAdmin = false;
            localStorage.removeItem('token');
            localStorage.removeItem('isAdmin'); // Clean up on clear
            return;
        }

        // Persist the token BEFORE calling getProfile() — the axios request
        // interceptor in api.js reads the token from localStorage at request
        // time, so writing it first ensures this very call (and the very
        // first call right after a fresh login) actually goes out authenticated.
        localStorage.setItem('token', token);
        user.token = token;

        try {
            // NOTE: getProfile() returns the raw User document (no { message, result }
            // wrapper) because the backend controller sends it directly. This is the
            // one endpoint in the whole API that doesn't follow the usual response shape,
            // so res.email / res.isAdmin below are correct as written — don't "fix" this.
            const res = await getProfile();

            user.email = res.email;
            user.firstName = res.firstName;
            user.isAdmin = res.isAdmin || false;

            // Persist the admin status to survive page reloads.
            // Stored as the string "true"/"false" — always compare with === 'true'
            // when reading it back (see line 11), never use it as a truthy check on
            // its own, since the string "false" is truthy in JS.
            localStorage.setItem('isAdmin', user.isAdmin);
        } catch (error) {
            // If the token is invalid or expired, wipe everything safely
            user.token = null;
            user.email = null;
            user.firstName = null;
            user.isAdmin = false;
            localStorage.removeItem('token');
            localStorage.removeItem('isAdmin');
        }
    }

    return {
        user,
        isAdmin,
        getUserDetails,
    }
});