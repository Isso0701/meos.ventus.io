# MEOS

Een responsive MEOS-demo website voor burgers, voertuigen, dossiers en signaleringen. Discord-login is verplicht; alleen leden van de ingestelde Discord-server krijgen toegang.

## Vereiste configuratie

De website is statisch en wordt gehost op GitHub Pages. Supabase verzorgt Discord-login en een Edge Function controleert serverlidmaatschap met een Discord-bot-token dat uitsluitend server-side wordt bewaard. De login werkt pas nadat de onderstaande Supabase- en Discord-configuratie is ingevuld.

### Benodigd

- Een Supabase-project
- Een Discord OAuth-app met Discord-provider ingesteld in Supabase
- Een Discord-bot in de server waarvan lidmaatschap vereist is
- Supabase CLI om de Edge Function te publiceren

### Instellen

1. Vul in `supabase-config.js` je Supabase Project URL en publishable/anon key in. Deze browserwaarden zijn openbaar; zet hier nooit een OAuth-secret of bot-token in.
2. Maak in de [Discord Developer Portal](https://discord.com/developers/applications) een OAuth-app. Gebruik als OAuth2-redirect-URL `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Nodig een bot uit dezelfde Discord-server uit en schakel **Server Members Intent** in bij de bot-instellingen.
4. Zet bij Supabase **Authentication → Providers → Discord** de Discord Client ID en Client Secret.
5. Stel in Supabase **Authentication → URL Configuration** je GitHub Pages-URL in als Site URL en voeg de volledige website-URL (inclusief `/<repository>/`) en lokale ontwikkel-URL toe aan de Redirect URLs.
6. Stel `DISCORD_BOT_TOKEN` en `DISCORD_GUILD_ID` als Edge Function secrets in via het Supabase-dashboard. Deel of commit deze waarden nooit.
7. Installeer de [Supabase CLI](https://supabase.com/docs/guides/cli), meld je aan en koppel je project vanuit deze map:

   ```text
   supabase login
   supabase link --project-ref <project-ref>
   supabase functions deploy verify-discord-membership
   ```

8. Upload de repository naar GitHub en schakel Pages in via **Settings → Pages**. Zie de aparte GitHub Pages-stappen hieronder.

Na configuratie wordt de gebruiker na Discord-login door de Edge Function gecontroleerd. Zonder geldige sessie of zonder lidmaatschap wordt de website niet geopend.

## Publiceren met GitHub Pages

1. Maak een GitHub-repository en upload de bestanden uit deze map.
2. Open **Settings → Pages** in de repository.
3. Kies bij **Build and deployment** voor **Deploy from a branch**.
4. Selecteer de branch `main` en de map `/(root)`, en klik op **Save**.
5. Na het publiceren staat de website op `https://<gebruikersnaam>.github.io/<repository>/`.

De `index.html` staat in de repository-root, zodat GitHub Pages deze direct kan serveren.

## Projectbestanden

- `index.html` — website en navigatie
- `style.css` — responsive vormgeving
- `app.js` — pagina's, zoeken en formulieren
- `demo.js` — fictieve voorbeeldgegevens en lokale opslag
- `auth.js` — Discord-login en controle van serverlidmaatschap
- `supabase/functions/verify-discord-membership/` — server-side Discord-lidmaatschapscontrole
- `supabase-config.js` — openbare Supabase-projectinstellingen

## Productiegebruik

De login beveiligt toegang tot de demo-interface, maar de dossier-, burger- en voertuiggegevens zijn nog steeds fictief en lokaal opgeslagen in de browser. GitHub Pages en browseropslag zijn geen beveiligde database. Gebruik geen echte persoonsgegevens; productiegegevens vereisen een backend met autorisatie en databasebeveiligingsregels (RLS).
