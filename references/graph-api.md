# Instagram Graph API Notes

Use this reference only when the user asks for API automation or already has Meta/Instagram API access.

## Fit

- The browser workflow is the default for ad hoc keyword research.
- The official API path is appropriate for repeatable, compliant monitoring where the user owns the required app, account, token, and permissions.
- Hashtag-oriented discovery may be possible through Instagram Graph API hashtag endpoints, including recent media for a hashtag, subject to Meta's current requirements and limits.
- Arbitrary full-text keyword search across public Instagram captions should not be assumed to exist as a simple official endpoint.

## Before Using

1. Verify the current Meta documentation because endpoint names, permissions, review requirements, fields, and rate limits change.
2. Confirm the user has authorization for the relevant Meta app, Instagram professional account, access token, and permissions.
3. Keep token handling out of chat. Use local environment variables or the user's existing secret manager.
4. Log API limits, time range, fields requested, and collection timestamp in the final answer.

## Guardrails

- Do not use unofficial APIs that require captured cookies, reverse-engineered mobile endpoints, or anti-bot bypass.
- Do not collect private, restricted, or non-user-visible content.
- Do not present API results as comprehensive unless the endpoint documentation explicitly supports that claim.

## Useful Official Starting Points

- Meta Instagram Platform documentation: https://developers.facebook.com/docs/instagram-platform/
- Instagram Graph API overview: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/
