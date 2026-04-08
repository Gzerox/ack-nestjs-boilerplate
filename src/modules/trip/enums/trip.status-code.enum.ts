export enum EnumTripStatusCodeError {
    notFound          = 5400,
    notDraft          = 5401,
    notPublished      = 5402,
    alreadyCancelled  = 5403,
    alreadyArchived   = 5404,
    alreadyPublished  = 5405,
    invalidTransition = 5406,
    publishConflict   = 5407,
    publishValidation = 5408,
    slugConflict      = 5440,
    travelerNotFound  = 5450,
}
