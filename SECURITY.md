# Security Policy

## Supported versions

Only the latest released version of UltraForce for Salesforce receives security updates.
Please make sure you are on the most recent version from the Chrome Web Store before reporting.

## Reporting a vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Report privately through either:

- GitHub's private vulnerability reporting: the "Report a vulnerability" button under this
  repository's **Security** tab (preferred), or
- Email: dormonbear@gmail.com

Please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- Affected version and browser

You can expect an acknowledgement within 5 business days. We will keep you informed of the fix
progress and coordinate a disclosure timeline with you.

## Security model

UltraForce is a client-side Chrome extension. It is worth understanding its trust boundaries:

- It reuses the **existing Salesforce session** from your browser cookies. It does not store,
  transmit, or log your credentials or session token to any third party.
- All Salesforce API calls run on your behalf and are limited to data you already have permission
  to access in Salesforce.
- There is **no backend server** and **no analytics** - nothing leaves your browser other than the
  direct calls to your own Salesforce org.
- The `cookies` permission is scoped to Salesforce domains only and is used solely to read your
  current session for authentication.

Reports about behavior consistent with this model (for example, "the extension reads Salesforce
cookies") are expected and not vulnerabilities. Reports about credential leakage, session exposure
to third parties, injection into the host page, or privilege escalation beyond the user's own
Salesforce permissions are in scope and very welcome.
