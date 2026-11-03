'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const loginShell = $('#login-shell');
  const appShell = $('#app-shell');
  const loginButton = $('#discord-login');
  const authStatus = $('#auth-status');
  const config = window.MEOS_CONFIG;
  let supabase;
  let verificationId = 0;
  let verifiedToken = '';
  const oauthError = new URLSearchParams(window.location.search).get('error_description');
  let loginMessage = oauthError
    ? `Discord-login geweigerd: ${oauthError}`
    : '';
  let loginMessageIsError = Boolean(oauthError);

  function showMessage(message, isError = false) {
    authStatus.textContent = message;
    authStatus.classList.toggle('error', isError);
  }

  function showLogin(message = '', isError = false) {
    appShell.hidden = true;
    loginShell.hidden = false;
    showMessage(message, isError);
  }

  function configured() {
    return config
      && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '')
      && typeof config.supabaseAnonKey === 'string'
      && config.supabaseAnonKey.length > 20
      && !config.supabaseAnonKey.includes('YOUR_');
  }

  async function checkMembership(session) {
    const requestId = ++verificationId;
    if (!session) {
      verifiedToken = '';
      showLogin(loginMessage, loginMessageIsError);
      loginMessage = '';
      loginMessageIsError = false;
      window.dispatchEvent(new CustomEvent('meos:signed-out'));
      return;
    }

    if (verifiedToken === session.access_token) return;
    appShell.hidden = true;
    loginShell.hidden = false;
    loginButton.disabled = true;
    showMessage('Discord-account en serverlidmaatschap controleren…');

    const { data, error } = await supabase.functions.invoke('verify-discord-membership');
    if (requestId !== verificationId) return;

    if (error || !data?.authorized) {
      verifiedToken = '';
      let message = data?.error
        || (error ? 'De servercontrole is mislukt. Probeer het later opnieuw.' : 'Je hebt geen toegang tot deze Discord-server.');
      if (error?.context?.json) {
        try {
          const responseBody = await error.context.json();
          message = responseBody.error || message;
        } catch {
          // Keep the readable fallback if the function response has no JSON body.
        }
      }
      loginMessage = message;
      loginMessageIsError = true;
      showMessage(message, true);
      await supabase.auth.signOut({ scope: 'local' });
      loginButton.disabled = false;
      return;
    }

    verifiedToken = session.access_token;
    const metadata = session.user.user_metadata || {};
    const name = metadata.full_name || metadata.name || metadata.user_name || 'Discord gebruiker';
    const avatar = Array.from(name.trim())[0]?.toLocaleUpperCase('nl-NL') || 'D';
    $('#profile-name').textContent = name;
    $('#profile-avatar').textContent = avatar;
    loginButton.disabled = false;
    showMessage('');
    loginShell.hidden = true;
    appShell.hidden = false;
    window.dispatchEvent(new CustomEvent('meos:authenticated', { detail: { user: session.user } }));
  }

  async function initialize() {
    if (!configured() || !window.supabase?.createClient) {
      loginButton.disabled = true;
      showMessage('De Supabase-configuratie ontbreekt of de Supabase-client is niet geladen. Controleer supabase-config.js en je internetverbinding.', true);
      return;
    }

    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      showMessage('De aanmeldstatus kon niet worden geladen. Vernieuw de pagina.', true);
      return;
    }
    await checkMembership(data.session);
    if (!data.session) loginButton.disabled = false;
    supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void checkMembership(session); });
    });
  }

  loginButton.addEventListener('click', async () => {
    if (!supabase) return;
    loginButton.disabled = true;
    showMessage('Je wordt doorgestuurd naar Discord…');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) {
      loginButton.disabled = false;
      showMessage(`Inloggen bij Discord is niet gelukt: ${error.message}`, true);
    }
  });

  $('#logout').addEventListener('click', async () => {
    loginButton.disabled = true;
    showMessage('Je wordt afgemeld…');
    const { error } = await supabase.auth.signOut();
    if (error) {
      loginButton.disabled = false;
      showMessage(`Uitloggen is niet gelukt: ${error.message}`, true);
    }
  });

  void initialize();
})();
