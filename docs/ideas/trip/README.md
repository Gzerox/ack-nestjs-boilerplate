# Trip Domain Implementation

## Purpose

This directory splits the Trip implementation into smaller, topic-focused documents so the aggregate lifecycle, traveler/PII surface, contacts, media, and attachments can evolve independently while staying connected.

All decisions in these files must continue to follow [.claude/CLAUDE.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/.claude/CLAUDE.md).

## Document Map

1. [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md): aggregate root, draft/publish lifecycle, invites, calendar events, and trip-level controllers.
2. [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md): traveler grouping, traveler records, trip-scoped traveler documents, and PII-aware traveler endpoints.
3. [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md): tenant contact book and trip support-contact linking.
4. [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md): trip media and event-linked media usage.
5. [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md): trip-specific files, legal material, and other managed attachments.
6. [trip-form.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-form.md): trip links to external forms created through the form module.
7. [docs/ideas/transport/itinerary.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/transport/itinerary.md): separate transport itinerary scope.

## Current Scope

The Trip domain currently includes these entities:

1. `Trip`
2. `TripInvite`
3. `TripCalendarEvent`
4. `TripTravelerGroup`
5. `TripTraveler`
6. `TripTravelerDocument`
7. `Contact`
8. `TripContact`
9. `TripMedia`
10. `TripAttachment`
11. `TripForm`

Core capabilities:

1. Create and maintain trips with a `DRAFT -> PUBLISHED -> ARCHIVED` or `CANCELLED` lifecycle.
2. Manage invitations before or after a user account exists.
3. Resolve accepted invitations into stable `TripTraveler` records.
4. Group invites, travelers, and calendar events through `TripTravelerGroup`.
5. Expose trip details to customers, including `calendarEvents.medias`, support contacts, and trip-level media.
6. Allow backend users to maintain tenant-scoped support contacts and attach them to trips.
7. Allow backend users to manage trip-specific attachments during trip setup and edits.
8. Keep trip-to-form linkage documented separately from form creation, which is owned by the form module.

## Shared Relationships

1. `Trip` is the aggregate root for the full Trip domain.
2. `TripInvite` is the invitation workflow record and may exist before the invitee has an account.
3. `TripTraveler` is the stable per-trip user access record created or reused after invite acceptance.
4. `TripTravelerGroup` is shared by invites, travelers, and calendar events.
5. `TripTravelerDocument` stays trip-scoped and must never be treated as reusable profile data.
6. `TripContact` links a trip to tenant-owned `Contact` records that act as support or assistance references for travelers.
7. `TripMedia` can be attached directly to a trip or to a specific `TripCalendarEvent`.
8. `TripAttachment` stores trip-specific files or policy/legal material managed during trip setup.
9. `TripForm` links a trip to forms created through the form module.

## Reading Order

1. Start with [trip.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip.md) for lifecycle, trip creation, publishing, and trip-facing APIs.
2. Continue with [trip-traveler.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-traveler.md) for traveler ownership, document visibility, and PII handling.
3. Use [trip-contact.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-contact.md) for tenant contact management and trip contact linking.
4. Use [trip-media.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-media.md) for trip and event media behavior.
5. Use [trip-attachments.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-attachments.md) for trip-level files and legal attachments.
6. Use [trip-form.md](/Users/dantoniolc/ghq/github.com/Gzerox/ack-nestjs-boilerplate/docs/ideas/trip/trip-form.md) when form linkage work is in scope.
