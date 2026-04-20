# Trip Invite (Current Implementation)

This file documents invite workflow, endpoints, and state rules as implemented.

## Endpoint Ownership

### Public/Auth Bootstrap

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/public/trips/:tripSlug` | Load public trip landing summary by slug. |
| `POST` | `/public/trips/:tripSlug/invites/check` | Resolve invite + next auth step (`signIn`/`signUp`). |
| `POST` | `/public/user/sign-up` | Create account for invitee signup flow. |
| `PATCH` | `/public/user/verify/email` | Verify account email via activation token. |
| `POST` | `/public/user/login/credential` | Log in with email/password before invite continuation. |

### Trip Invite Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/user/trips/invites` | List current-user invites (trip user controller root). |
| `POST` | `/user/trips/invites/accept` | Accept invite token and attach traveler membership. |
| `GET` | `/user/trips/:idTrip` | Load trip detail after traveler access is granted. |
| `POST` | `/shared/trips/:idTrip/invites` | Create trip invites from shared surface. |
| `PATCH` | `/shared/trips/:idTrip/invites/:idInvite/revoke` | Revoke an invite from shared surface. |

### Post-Acceptance Form Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/user/trips/:idTrip/forms` | List current-user form assignments for trip. |
| `GET` | `/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId` | Read one assigned form with answers. |
| `POST` | `/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId/submit` | Submit one form assignment response. |

## Invite Status Model

`TripInviteStatus` values:

1. `pending`
2. `invited`
3. `accepted`
4. `revoked`

Current write behavior:

1. Invite create flows set status to `pending`.
2. `check` treats `pending` and `invited` as signup-path states.
3. `accept` sets `accepted` and attaches/creates traveler.
4. `revoke` sets `revoked`.

## Validation Rules

1. `check` only resolves invites for published, non-deleted trips.
2. `accept` is token-based (`token` in body), not invite-id route-based.
3. `accept` rejects invalid token, revoked, expired, or already accepted invites.
4. `revoke` rejects already revoked invite.
5. `(tripId, email)` uniqueness is enforced in DB.

## Invite Workflow Diagram

```mermaid
sequenceDiagram
    actor BO as Backoffice
    actor P as Participant
    participant C as Client
    participant API as API
    participant MAIL as Email Service
    participant DB as Database

    BO->>P: Share join URL with trip slug
    P->>C: Open trip landing
    C->>API: GET /api/v1/public/trips/:tripSlug
    API->>DB: Load published trip by slug
    DB-->>API: Trip summary
    API-->>C: Public trip summary

    P->>C: Enter email
    C->>API: POST /api/v1/public/trips/:tripSlug/invites/check
    API->>DB: Find invite by (tripSlug,email)

    alt Invite not found/revoked/expired
        API-->>C: Error (inviteNotFound | inviteRevoked | inviteExpired)
        C-->>P: Stop flow and show failure state
    else Invite linked to existing user OR accepted fallback
        API-->>C: { nextStep: "signIn" }
        P->>C: Continue with sign-in
    else Pending/Invited without linked user
        API-->>C: { nextStep: "signUp" }
        P->>C: Fill sign-up data
        C->>API: POST /api/v1/public/user/sign-up { email, password, name, countryId, marketing, cookies, from }
        API->>DB: Create user + email verification token
        API->>MAIL: Send activation email with verification link
        MAIL-->>P: Activation link received
        P->>C: Open activation link
        C->>API: PATCH /api/v1/public/user/verify/email { token }
        API->>DB: Mark email as verified
        API-->>C: Email verified
        C-->>P: Show confirmation page with "Login to continue"
    end

    P->>C: Sign in with credential
    C->>API: POST /api/v1/public/user/login/credential
    API->>DB: Validate account/session prerequisites
    API-->>C: Login success (tokens/session)

    C->>API: GET /api/v1/user/trips/invites?status=pending
    API->>DB: Fetch pending trip invites for logged-in user
    API-->>C: Pending invite list

    alt Pending trip invites exist
        C-->>P: Show pending invites notification/popup
        P->>C: Confirm invite acceptance
        C->>API: POST /api/v1/user/trips/invites/accept { token }
        API->>DB: Validate token + status + expiry
        API->>DB: Mark invite accepted
        API->>DB: Create TripTraveler if missing
        API-->>C: 200 OK
    else No pending trip invites
        C-->>P: Continue without invite popup
    end

    C->>API: GET /api/v1/user/trips/:idTrip/forms?status=pending
    API->>DB: List active published form assignments for user/trip
    API-->>C: Pending assignments

    alt Pending forms exist
        C-->>P: Present pending form actions to user
        P->>C: Open selected form
        C->>API: GET /api/v1/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId
        API-->>C: Form schema + current answers
        P->>C: Submit answers
        C->>API: POST /api/v1/user/trips/:idTrip/forms/:idForm/assignments/:assignmentId/submit
        API->>DB: Validate + store answers + mark submitted
        API-->>C: Form submitted
        C-->>P: Show completion confirmation + next steps + link "See trip details"
    end

    P->>C: Click "See trip details"
    C->>API: GET /api/v1/user/trips/:idTrip
    API-->>C: Trip detail (published + traveler access)
```

## Security Notes

1. `invites/check` can be abused for invite-state probing and should have rate limiting and anti-bot controls.
2. Accept flow relies on raw token secrecy on client links.
3. Current create invite flow hashes raw tokens server-side; delivery channel is out of scope in this module.
