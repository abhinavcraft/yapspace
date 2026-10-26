# YapSpace branded authentication emails

These files are prepared templates. They have not been applied to the hosted project.

Open Authentication → Emails → Templates in the Supabase dashboard.

| Template | Subject | HTML body |
| --- | --- | --- |
| Reset password | A fresh start for your YapSpace password | `recovery.html` |
| Confirm sign up | Your people. Your space. Confirm your email. | `confirmation.html` |

Paste each complete HTML file into its matching template's source editor, set the subject, and save. Keep every `{{ .ConfirmationURL }}` placeholder intact: Supabase inserts the secure action link per email. Do not replace it with the homepage.

Preview: `E:/yapspace/YapSpace-email-preview.html`. Its buttons are intentionally inactive; preview links are examples only.

The templates use presentation tables, inline styles, system fonts, responsive spacing, and an Outlook button fallback. No external images, fonts, trackers, or paid services are required for the designs. Actual email-client rendering should be checked with a test message after saving.

Sender name/address, SMTP delivery and sending limits are separate Supabase settings. These HTML files do not configure a verified sender or resolve email rate limits. Use YapSpace as the sender name; only set an address on yapspace-agnivya.vercel.app after verifying that domain with your email provider.

To regenerate the HTML and preview, run `node scripts/generate-email-templates.mjs` from the app folder.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
