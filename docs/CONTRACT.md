LASTGEN API CONTRACT — FROZEN
BASE /api · Auth: Bearer <supabase_jwt> · Money in KOBO (int) · Energy in Wh (int)
Envelope: { ok: boolean, data?: T, error?: { code, message } }

SHARED CONSTANTS (both sides MUST use these exact values)
  CO2_KG_PER_LITRE_PETROL = 2.31
  CO2_KG_PER_LITRE_DIESEL = 2.68
  DEFAULT_GRACE_PERIOD_HOURS = 72
  MIN_LIGHTING_CIRCUIT_W = 40      // preserved even when suspended

BUSINESS & BURN
POST /businesses            { name, type, city, generatorKva?, hoursPerDay? } -> Business
GET  /businesses/:id                                    -> Business
POST /businesses/:id/receipts   multipart: file         -> FuelLog   (vision extract)
POST /businesses/:id/fuel-logs  { litres, amountKobo, pricePerLitreKobo, loggedAt } -> FuelLog
GET  /businesses/:id/burn                               -> BurnProfile

QUOTES
GET  /systems                ?minKw&maxPriceKobo        -> { items: SolarSystem[] }
POST /businesses/:id/quote   { systemId, tenorMonths, depositKobo? } -> Quote
GET  /quotes/:id                                        -> Quote

CREDIT (bank side)
GET  /credit/applications    ?status                    -> { items: CreditFile[] }
GET  /credit/applications/:id                           -> CreditFileDetail
POST /credit/applications/:id/approve                   -> { loan, asset }
POST /credit/applications/:id/decline  { reason }       -> CreditFile

ASSETS & ENFORCEMENT
GET  /assets/:id                                        -> Asset
GET  /assets/:id/meter       ?from&to                   -> { items: MeterReading[] }
POST /assets/:id/suspend     { reason }                 -> Asset   (bank only)
POST /assets/:id/restore                                -> Asset   (bank only)

LOANS & PAYMENTS
GET  /loans/:id                                         -> Loan
POST /loans/:id/pay          { amountKobo }             -> { payment, loan, asset }
GET  /loans/:id/schedule                                -> { items: Installment[] }

PORTFOLIO
GET  /portfolio/stats                                   -> PortfolioStats
GET  /portfolio/assets       ?status&city&page          -> { items: Asset[], total }
POST /portfolio/export                                  -> { url, generatedAt }

IMPACT
GET  /businesses/:id/impact  ?period=month|year|all     -> ImpactSummary
GET  /businesses/:id/wrapped ?year                      -> WrappedPayload

DEMO CONTROL (unauthenticated, demo only)
POST /demo/reset                                        -> { ok }
POST /demo/advance-time      { days }                   -> { ok }
POST /demo/miss-payment      { loanId }                 -> { loan, asset }

WEBHOOKS
POST /webhooks/alat          ALAT Transaction Notification payload -> { ok }
                             MUST be idempotent on transactionReference

TYPES
Business      { id, name, type, city, generatorKva, hoursPerDay, createdAt }
FuelLog       { id, businessId, source:'receipt'|'manual', litres, amountKobo,
                pricePerLitreKobo, loggedAt, receiptUrl?, confidence? }
BurnProfile   { businessId, litresPerDay, dailyKobo, monthlyKobo, annualKobo,
                daysObserved, verified:boolean, computedAt }
SolarSystem   { id, name, capacityKw, panelW, batteryKwh, inverterKva,
                priceKobo, coversKva }
Quote         { id, businessId, system:SolarSystem, tenorMonths, depositKobo,
                monthlyPaymentKobo, aprBps, totalPayableKobo,
                monthlySavingsKobo, savingsPct, breakEvenMonth }
CreditFile    { id, businessId, business:Business, burn:BurnProfile,
                quote:Quote, affordabilityRatio, loadProfileScore,
                verifiedMonths, status:'PENDING'|'APPROVED'|'DECLINED', createdAt }
Asset         { id, businessId, systemId, serial, controllerId,
                status:'ACTIVE'|'GRACE'|'SUSPENDED'|'OWNED',
                installedAt, suspendedAt?, suspendReason? }
Loan          { id, assetId, principalKobo, tenorMonths, monthlyPaymentKobo,
                balanceKobo, nextDueAt, status:'ACTIVE'|'DELINQUENT'|'CLOSED' }
Installment   { n, dueAt, principalKobo, interestKobo, balanceKobo, paidAt? }
Payment       { id, loanId, amountKobo, paidAt, source:'ALAT'|'SIMULATED', reference }
MeterReading  { id, assetId, ts, whGenerated, whConsumed, batterySocPct }
ImpactSummary { litresDisplaced, co2KgAvoided, nairaSavedKobo,
                kwhGenerated, monthsToOwnership }
PortfolioStats{ assetsFinanced, portfolioValueKobo, repaymentRatePct,
                parPct, suspendedCount, litresDisplaced, co2TonnesAvoided,
                byCity:[{city,count}] }
WrappedPayload{ year, nairaSavedKobo, litresNotBurned, co2KgAvoided,
                kwhGenerated, monthsToOwnership, bestMonth, rank }

STATE MACHINES
Asset: ACTIVE -> GRACE (payment overdue)
       GRACE  -> SUSPENDED (grace expires)  | -> ACTIVE (payment received)
       SUSPENDED -> ACTIVE (payment received)
       ACTIVE -> OWNED (loan balance = 0)
       Suspension NEVER applies if business.medicalFlag = true
Loan:  ACTIVE -> DELINQUENT -> ACTIVE | CLOSED

LEASE MATH (both sides must match exactly)
  monthlyRate = aprBps / 10000 / 12
  payment = P * r / (1 - (1+r)^-n)        // standard amortisation
  monthlySavings = burn.monthlyKobo - quote.monthlyPaymentKobo
  A quote is only VALID if monthlySavings > 0. Reject otherwise.