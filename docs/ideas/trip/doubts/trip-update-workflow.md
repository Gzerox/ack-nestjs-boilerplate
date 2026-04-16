## Trip Update Workflow (Split PUT Endpoints)

## Goal

Move from one mixed trip update payload to a split update model:

1. one endpoint for trip base fields
2. one dedicated endpoint per trip relation

This keeps each update surface explicit and reduces ambiguity in update behavior.

## Final Direction

Use `PUT` everywhere for update operations, with full-overwrite semantics.

1. `PUT /trips/:idTrip` updates only trip base information
2. each relation is updated through its own endpoint
3. each relation `PUT` replaces the full relation set for that trip

## Endpoint Map

1. `PUT /trips/:idTrip`
   - Updates base trip fields only (title, descriptions, dates, flags, etc.)
   - Does not modify relation collections.

2. `PUT /trips/:idTrip/calendar-events`
   - Replaces `trip.calendarEvents`.

3. `PUT /trips/:idTrip/contacts`
   - Replaces contacts associated with the trip.

4. `PUT /trips/:idTrip/travelers`
   - Replaces travelers associated with the trip.

5. `PUT /trips/:idTrip/attachments`
   - Replaces legal document attachments associated with the trip.

6. `PUT /trips/:idTrip/itineraries`
   - Replaces trip itineraries.

## Semantics (Important)

1. `PUT` means full overwrite of the target resource scope.
2. Scope is endpoint-specific:
   - `/trips/:idTrip` scope = trip base fields only
   - `/trips/:idTrip/<relation>` scope = that relation only
3. Missing items in relation payload mean they are removed from that relation set.
4. No relation should be modified by another relation endpoint.
5. Each endpoint should be idempotent.

## Transaction Boundaries

1. Every endpoint runs in one transaction for its own scope.
2. A request either fully succeeds for that scope or fully fails.
3. Cross-scope updates are done by multiple calls from the client.

## Suggested Validation Rules

1. `:idTrip` must exist and be editable.
2. Payload must be complete for the endpoint scope.
3. Child records in relation endpoints must belong to `idTrip` after the overwrite.
4. Optional optimistic concurrency (`version` or `updatedAt`) returns `409 Conflict` on mismatch.

## Example Payloads

### 1) Base trip update

```json
{
  "title": "Summer in Greece",
  "shortDescription": "Island-hopping itinerary",
  "startDate": "2026-07-02",
  "endDate": "2026-07-12"
}
```

### 2) Calendar events overwrite

```json
{
  "calendarEvents": [
    {
      "title": "Arrival in Athens",
      "startAt": "2026-07-02T10:00:00Z",
      "endAt": "2026-07-02T12:00:00Z"
    },
    {
      "title": "Ferry to Naxos",
      "startAt": "2026-07-04T07:30:00Z",
      "endAt": "2026-07-04T12:00:00Z"
    }
  ]
}
```

## Why This Split

1. Removes ambiguity from mixed aggregate updates.
2. Makes endpoint ownership clear for each sub-resource.
3. Simplifies client intent: update only the part being edited.
4. Improves validation, observability, and rollback behavior per resource.
