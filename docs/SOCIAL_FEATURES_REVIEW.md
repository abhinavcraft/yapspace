# Friends, presence and typing — deployment review

## Current release state

The feature implementation and migration are prepared locally. **The production migration was rejected by automatic approval review and has not been applied.** The live frontend remains on its prior working deployment. No customer messages, profiles or account identities were changed by this feature work.

The reviewed migration is `supabase/migrations/20261026002230_social_presence.sql`. It is additive and is safe to rerun in the local setup bundle. It does not repair or rewrite the project's previously discussed baseline migration history.

## Proposed production changes

- Add a `friendships` table with one normalized pair, lifecycle state, timestamps, row security and indexes. Client roles receive SELECT only, restricted to the two participants.
- Add three authenticated RPCs for listing relationships, sending requests and responding. Narrow SECURITY DEFINER functions bind the actor to auth.uid(), use an empty search_path and reject anonymous calls. Lists return only names/usernames and relationship metadata. The existing profile RLS and profile password checks are unchanged.
- Send/cancel/accept/decline/remove transitions enforce the caller's role. Crossed requests stay pending until the recipient explicitly accepts. New requests have a 10/minute limit, 100-pending limit and a one-minute repeat cooldown. Removing a friend retains existing conversations and messages.
- Add an identifier-only, private friend-notification trigger with a fallback polling refresh. Notification failures do not roll back requests.
- Add SELECT/INSERT policies on `realtime.messages` for activity. Grant authenticated INSERT on that table, with RLS restricting it to the user's own presence channel or the user's own typing topic inside a conversation they belong to. Browser clients cannot forge database message events or friend notifications.

The security boundary changes are persistent: signed-in users gain friend-request operations and restricted ephemeral activity publishing. This affects all signed-in users. Rollback can first revert the frontend; database tables need not be dropped and existing messages need not be touched.

## Client behavior

- Friends workspace: All, Online, Requests and Add friend; incoming/outgoing sections; search by name/handle; accept, decline, cancel and remove actions; request badges in desktop/mobile navigation.
- Online/offline indicators use Presence state. Unknown/reconnecting status is shown as unavailable instead of incorrectly claiming offline. Presence is visible only to accepted friends and existing conversation partners through private-channel policies.
- Typing sends a boolean only, throttled to roughly one update per two seconds. It stops on send, blur, inactivity, offline, conversation switch or unmount. Receiver state expires after five seconds when a stop event is lost. Message drafts and content are never transmitted as typing payloads.
- Each user's presence/typing topic is writable only by that user, preventing another participant from spoofing their activity.
- Each tab observes at most 60 peers, prioritizing the current chat. Remaining peers show unavailable status. This bounds channels under common provider limits; it is not a large-workspace presence architecture.
- Existing conversations remain available. Friend requests organize new connections; the original participant-scoped messaging RPCs retain their access rules.
- The visual update adds a violet social workspace, friend avatars, request cards, connection dots, typing animation, softer chat surfaces and responsive mobile controls. Reduced-motion preference disables the typing animation.

## Required deployment checks

1. Obtain explicit approval for the production migration after the automatic rejection. Do not bypass it via SQL Editor or another tool.
2. Apply the exact reviewed migration, then check installed RPC grants and security advisors. Any new authenticated SECURITY DEFINER notices require the documented actor-bound review; do not expose these functions anonymously.
3. In Supabase Realtime Settings, disable **Allow public access**, as required by Supabase's private-channel guidance. This setting has not been verified through the available tools.
4. Deploy the exact tested frontend and verify live HTTP assets/security headers.
5. Use two disposable authenticated accounts to check request arrival, accepted-friend presence, multiple tabs, typing expiry, reconnect, and outsider denial over actual WebSockets. Local SQL policy checks do not substitute for that complete hosted flow. Browser automation is unavailable in this session; no visual browser signoff is claimed.

Local validation: **65 unit checks and 71 embedded PostgreSQL checks passed**, along with the production Vite build, secret scan and exact-project CSP check. These checks ran without sending emails, creating production accounts or changing customer data. Regression coverage includes existing-account setup protection and original messaging behavior. Server-rendered view checks cover online/offline/unknown status, accepted-friend rendering, pending requests excluded from the conversation picker and the empty-state action; these are not a visual browser review.

Official reference: https://supabase.com/docs/guides/realtime/authorization
