# team-admin Edge Function

Organizer-only administration endpoint for DesignFlow OS Phase 1: invites new
users and activates/deactivates accounts. All privileged writes use the
service-role key inside the function — clients never need it.

## Deploy

```bash
# From the repo root (supabase/ directory must contain config.toml or use --project-ref)
supabase functions deploy team-admin
```

## Secrets

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

The function also reads `SUPABASE_URL` and `SUPABASE_ANON_KEY`; Supabase
injects both automatically for deployed functions. Never commit secrets.

## Supabase Auth email configuration

The `invite` action calls `auth.admin.inviteUserByEmail`, which sends the
built-in Supabase "Invite user" email:

1. Dashboard -> Authentication -> Email Templates -> enable and customize the
   **"Invite user"** template.
2. Dashboard -> Authentication -> URL Configuration:
   - Set **Site URL** to the app origin, e.g. `https://app.example.com`.
   - Under **Redirect URLs**, add the app origin and the reset/set-password
     page, e.g. `https://app.example.com/reset-password`.
   - Invite links resolve against these URLs; without the redirect URL the
     invitee's confirmation link will be rejected.

## Calling from the frontend

```ts
const { data, error } = await supabase.functions.invoke("team-admin", {
  body: {
    action: "invite",
    full_name: "Jane Doe",
    email: "jane@example.com",
    designation: "Senior Designer",
    role: "designer", // organizer | team_lead | designer | social_media_manager
  },
});
// -> { ok: true, user_id: "<uuid>" }
```

```ts
const { data, error } = await supabase.functions.invoke("team-admin", {
  body: { action: "set_active", user_id: "<uuid>", is_active: false },
});
// -> { ok: true }
```

The caller's session JWT is passed automatically by `functions.invoke` and is
validated inside the function. The caller must be an **organizer** with an
active profile, otherwise the function returns 403.

## Behavior notes

- `invite` validates input (400), rejects duplicate emails against both
  `profiles` and the auth user list (409), creates the auth user via invite,
  then inserts the `profiles` and `user_roles` rows. If any insert fails, the
  function deletes the partially created auth user so nothing is left
  half-created (500).
- `set_active` validates the UUID and boolean (400), refuses self-deactivation
  (409), and refuses deactivating the last active organizer (409).
- Every action writes a row to `system_audit_logs` (`user.invited`,
  `user.deactivated`, `user.activated`).
- Unknown actions return 400; non-POST requests return 405; OPTIONS is handled
  for CORS. All responses are JSON and contain no secrets.
