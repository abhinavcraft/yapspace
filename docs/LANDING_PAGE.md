# YapSpace landing page

The signed-out homepage introduces one-to-one messaging, friends, presence/typing, appearance, mobile navigation and profile editing. Existing signed-in sessions still open the messaging app. Hash links `#join` and `#signin` open the existing authentication UI; recovery remains ahead of the landing-page branch.

Design: warm paper, ink, lilac and acid-yellow accents; editorial typography; product screenshots instead of stock imagery. No invented customer counts or testimonials. The FAQ accurately states that messages are not end-to-end encrypted.

Screenshots in `public/images/` were captured from the current app in an isolated browser using its local fictional demo data. Requests to the Supabase project were blocked during capture. No live account, conversation or authentication token appears in the screenshots. The friend-request illustration is labelled as a sample.

Validated with a production build, the existing 65 unit tests, and isolated desktop/phone browser checks at 1440 and 390 pixels: no horizontal page overflow or page errors; appearance toggle, screenshot dialog/Escape, signup navigation and return-home navigation passed. Additional narrow/tablet widths are checked during final release verification. No outbound signup or email was submitted.

Reddit research informed the focus on a clear product explanation, visible screenshots and a distinct visual voice:
- https://www.reddit.com/r/UI_Design/comments/1st9xmw/need_some_feedback_on_the_landing_page/
- https://www.reddit.com/r/microsaas/comments/1r6jurz/i_opened_20_saas_landing_pages_launched_this/

Email SMTP delivery investigation remains separate; this page does not change Supabase email settings.
