# Supabase Auth email templates (optional)

The web app already asks Supabase for email links that work in any browser, so these templates are not required. They
are a second option for projects with a custom SMTP server: Supabase only lets you edit templates once custom SMTP is
configured.

Paste each file into **Authentication → Emails → Templates** in the Supabase dashboard (the file name is the template:
`confirmation` = Confirm signup, `magic_link`, `recovery` = Reset password, `invite`, `email_change`).

Supabase's default templates link to `{{ .ConfirmationURL }}`, which returns a PKCE `code`. That only completes in the
browser that started the flow, so a link opened from a mail app or another device ends in "PKCE code verifier not
found". These templates link straight to the app with a token hash instead
(`/auth/callback?token_hash=…&type=…`), which the callback page verifies in any browser.

`{{ .SiteURL }}` is the Site URL under Authentication → URL Configuration; it must be the web app's address.
