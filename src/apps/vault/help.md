# Password Vault & Generator

Master-password AES-GCM encrypted vault, password and passphrase generator, RFC 6238 TOTP authenticator, and local security audit.

## Features

- **Master Password Encryption**: Protect all credentials with AES-GCM-256 and PBKDF2 key derivation. Passwords never touch unencrypted storage.
- **Auto-Clearing Clipboard**: When copying sensitive passwords, the system clipboard is automatically sanitized after 30 seconds.
- **Password & Passphrase Generator**: Generate random high-entropy passwords or memorable 4-word passphrases in English and German.
- **RFC 6238 TOTP Authenticator**: Built-in two-factor authentication (2FA) with live 30-second token refresh and countdown timers.
- **Local Security Health Audit**: Detects reused, weak, and stale (> 180 days) passwords entirely within your browser without sending data over the network.
- **CSV Import & Export**: Import from other password managers or export with security warnings.
