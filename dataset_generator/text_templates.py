"""
FIR narrative templates for Phase D (schema spec Section 7).

Compositional, not flat: each stage is built from several independent
"sentence groups" (see FRAGMENT_GROUPS shape below), and one variant is
chosen from each group per document. Every fragment is a complete,
independently-grammatical sentence ending in its own punctuation - this is
what makes composition safe: stitching together N independently-chosen
complete sentences (`" ".join(...)`) is always coherent, regardless of
which combination gets picked, unlike splicing together partial clauses
that depend on each other's grammar. A stage with 3 groups of 5 variants
each produces 125 distinct sentence combinations instead of 5 flat ones -
effective variety scales combinatorially with authoring effort, not
linearly.

Each fragment is a plain string with `{slot_name}` placeholders. Rendering
(see `render_template` in fir_generator.py) walks the string once, appending
literal text and slot values in order and recording the exact character span
of each inserted value as it is appended - never re-locating a value in the
finished text with something like `str.find()`, which would give the wrong
span for any value that happens to repeat.

Slot -> NER label mapping (`SLOT_LABELS`) says how each placeholder should be
labeled when it is actually filled in. `{phone}` is filled whenever the
case's victim has a PHONE entity - `fir_generator.py`'s `_usable()` check
filters out any fragment whose required slots aren't backed by real data for
a given case, so a `{phone}` fragment is simply never selected for a
victim without one, rather than a number being invented.
"""

SLOT_LABELS = {
    "victim_name": "PERSON",
    "impersonated_authority": "ORG",
    "amount": "AMOUNT",
    "account_ref": "ACCOUNT",
    "phone": "PHONE",
    "location": "LOCATION",
}

# Categorical authority choices for the digital_arrest narrative
# (I4C's documented impersonation targets) - the SET of 6 is a real,
# source-backed constraint (I4C's own advisory names exactly these), left
# as-is. What varies is the PHRASING used to refer to each one, chosen once
# per document (not per-mention) so a single FIR stays internally
# consistent, the way a real complainant would refer to "the CBI" the same
# way throughout their own statement.
DIGITAL_ARREST_AUTHORITIES = ["police", "cbi", "rbi", "customs", "narcotics", "ed"]

AUTHORITY_DISPLAY_VARIANTS = {
    "police": ["Cyber Crime Police", "the Cyber Crime Police Station", "a Cyber Cell officer"],
    "cbi": ["Central Bureau of Investigation (CBI)", "the CBI", "a CBI officer"],
    "rbi": ["Reserve Bank of India (RBI)", "the RBI", "an RBI compliance officer"],
    "customs": ["Indian Customs Department", "the Customs Department", "a Customs official"],
    "narcotics": ["Narcotics Control Bureau (NCB)", "the NCB", "an NCB officer"],
    "ed": ["Enforcement Directorate (ED)", "the ED", "an ED officer"],
}

# ---------------------------------------------------------------------------
# digital_arrest: 4 stages, 3 sentence-groups each.
# ---------------------------------------------------------------------------
DIGITAL_ARREST_TEMPLATES = {
    "impersonation": [
        [  # group 1: how contact was made
            "The complainant {victim_name} received a video call from an unknown number claiming to be from the {impersonated_authority}.",
            "{victim_name} was contacted by a caller identifying himself as an officer of the {impersonated_authority}.",
            "A person representing themselves as an official of the {impersonated_authority} called {victim_name} directly.",
            "{victim_name} received a WhatsApp video call from a man in what appeared to be an official uniform, claiming to represent the {impersonated_authority}.",
            "The complainant {victim_name} was contacted from {phone} by a caller claiming to be from the {impersonated_authority}.",
        ],
        [  # group 2: the fabricated pretext
            "The caller stated that a parcel booked under the complainant's identity documents had been seized and was linked to an ongoing criminal case.",
            "The caller claimed that the complainant's bank account had been used in a money-laundering case currently under investigation.",
            "The caller alleged that a courier addressed to the complainant contained banned substances and that the matter had already been escalated for legal action.",
            "The caller stated that the complainant's identity documents had been used to open a fraudulent bank account.",
            "The caller alleged that a case had already been registered against the complainant in another state under the complainant's name.",
        ],
        [  # group 3: framing / geography
            "The complainant, residing in {location}, was told the matter could only be resolved by cooperating directly with the officer on the call.",
            "{victim_name} was told that local authorities in {location} had already been notified of the case.",
            "The caller instructed {victim_name} not to disconnect the call under any circumstances.",
            "{victim_name} was told the case file had been transferred from {location} to a central unit for further action.",
            "The caller insisted that verification would only take a few minutes if {victim_name} cooperated fully.",
        ],
    ],
    "intimidation": [
        [  # group 1: the threat itself
            "The caller warned {victim_name} that any refusal to cooperate would result in immediate arrest.",
            "The complainant was told that a non-bailable warrant had already been issued against {victim_name}.",
            "{victim_name} was shown a fabricated arrest warrant bearing an official-looking seal.",
            "The caller threatened that {victim_name}'s passport would be impounded and international travel blocked.",
            "{victim_name} was told that the case had been marked sensitive and highly confidential.",
        ],
        [  # group 2: escalation / consequence
            "The threats continued to come from the same number, {phone}.",
            "{victim_name} was told to remain reachable at all times on {phone} for further instructions.",
            "The caller warned that public disclosure of the case to family members and employers would follow any refusal.",
            "{victim_name} was warned that bank accounts would be frozen within the hour unless the matter was resolved directly with the officer on the call.",
            "The caller stated that a raid at the complainant's residence in {location} would follow within thirty minutes.",
        ],
        [  # group 3: location / authority framing
            "The caller warned that any attempt to approach the local police station in {location} would result in additional charges being added.",
            "{victim_name} was told that the case had already crossed jurisdictional boundaries and could not be resolved locally.",
            "The caller claimed the matter was being personally monitored by a senior officer of the {impersonated_authority}.",
            "{victim_name} was told that contacting a lawyer before resolving the call would be treated as an admission of guilt.",
            "The caller repeated that only strict compliance would prevent the case from being escalated further.",
        ],
    ],
    "confinement": [
        [  # group 1: the isolation tactic
            "{victim_name} was instructed to remain on video call continuously and not disconnect or leave the room, a tactic later identified as a 'digital arrest'.",
            "The complainant was directed to move to an isolated room and keep the camera on at all times.",
            "{victim_name} was kept under continuous video surveillance by the caller for several hours.",
            "The caller insisted that {victim_name} stay visible on camera throughout, citing a 'verification protocol'.",
            "{victim_name} was told that stepping away from the call, even briefly, would be treated as an admission of guilt.",
        ],
        [  # group 2: enforced silence
            "{victim_name} was instructed not to inform anyone, including bank officials, about the nature of the call.",
            "The caller, reachable throughout on {phone}, warned against contacting any family member during the call.",
            "I was contacted from {phone} claiming to be from the {impersonated_authority} and told not to disconnect.",
            "The complainant was told that any attempt to mute the call or step out of frame would trigger immediate arrest.",
            "{victim_name} was kept isolated from outside contact for the duration of the extortion.",
        ],
    ],
    "extortion": [
        [  # group 1: the payment instruction
            "Under continued threat, {victim_name} was instructed to transfer Rs. {amount} to account {account_ref}.",
            "{victim_name} was told to deposit Rs. {amount} into account {account_ref}.",
            "The caller directed {victim_name} to transfer Rs. {amount} to account {account_ref} under the pretext of an 'escrow' arrangement.",
            "{victim_name} transferred Rs. {amount} to account {account_ref} after being convinced the payment was a temporary hold.",
            "Believing the threat to be genuine, {victim_name} sent Rs. {amount} to account {account_ref}.",
        ],
        [  # group 2: the framing given for the payment
            "The amount was described by the caller as a 'refundable security deposit' pending verification.",
            "The caller described the amount as an 'RBI compliance fine', with an assurance that it would be returned after the investigation concluded.",
            "The payment was framed as an amount supposedly monitored by the {impersonated_authority} and refundable in full.",
            "The caller described the amount as a mandatory 'processing fee' required for case closure.",
            "Confirmation of the payment was demanded to be sent to {phone} immediately after the transfer.",
        ],
    ],
}

# ---------------------------------------------------------------------------
# Simpler lure -> escalating deposit -> lockout structure, 3 sentence-groups
# per stage, for the three non-digital-arrest subtypes.
# ---------------------------------------------------------------------------
SIMPLE_SUBTYPE_TEMPLATES = {
    "investment_app": {
        "lure": [
            [
                "{victim_name} was added to a WhatsApp group promoting a stock-trading application that promised guaranteed daily returns.",
                "An online advertisement led {victim_name} to download an investment application claiming affiliation with a well-known trading platform.",
                "{victim_name}, based in {location}, was approached on social media by an individual offering access to a private trading group.",
                "The complainant {victim_name} was introduced to the scheme through a friend's referral link.",
                "{victim_name} received repeated calls from a self-described 'investment advisor' who persuaded the complainant to install a trading application.",
            ],
            [
                "The group promised weekly returns of ten to fifteen percent, managed by an administrator reachable at {phone}.",
                "A self-described 'relationship manager' began contacting the complainant directly from {phone}.",
                "{victim_name} was shown screenshots of large profits allegedly earned by other members of the group.",
                "The advisor's calls came from the number {phone}, encouraging {victim_name} to start with a small trial investment.",
                "The application was obtained outside the official app stores, on the advisor's specific instruction.",
            ],
        ],
        "deposit": [
            [
                "{victim_name} initially deposited a small amount and was shown fabricated profits on the application's dashboard.",
                "Encouraged by the visible but fictitious returns, {victim_name} transferred a further amount to unlock a higher investment tier.",
                "{victim_name} was told that a minimum balance was required before the application would permit any withdrawal.",
                "Over several weeks, {victim_name} transferred a cumulative sum on the assurance of steadily compounding returns.",
                "{victim_name} was persuaded to arrange an additional transfer after being shown an urgent 'limited slot' offer inside the application.",
            ],
            [
                "The transfer of Rs. {amount} was made to account {account_ref}.",
                "{victim_name} sent Rs. {amount} to account {account_ref} after a follow-up call from {phone} confirming the offer.",
                "A total of Rs. {amount} was transferred to account {account_ref} over the course of the scheme.",
                "The final transfer of Rs. {amount} to account {account_ref} was made on the advisor's direct instruction.",
                "Rs. {amount} was sent to account {account_ref}, with reassurance calls periodically received from {phone}.",
            ],
        ],
        "lockout": [
            [
                "When {victim_name} attempted to withdraw the accumulated balance, the application demanded an additional 'tax' payment first.",
                "{victim_name}'s withdrawal requests were repeatedly rejected with vague error messages.",
                "Shortly after the final transfer, the application became inaccessible.",
                "{victim_name} discovered that the trading dashboard showed unrealistic gains that could not be withdrawn.",
                "The application was removed from circulation entirely shortly after the final payment.",
            ],
            [
                "The assigned relationship manager, previously reachable at {phone}, subsequently stopped responding.",
                "The support number, {phone}, previously used by {victim_name}, was found to be disconnected.",
                "All communication from the platform's representatives ceased at that point.",
                "{victim_name} was unable to recover any of the amounts transferred, nor reach anyone at the previously used number {phone}.",
                "No further contact was received from the platform after the final transfer.",
            ],
        ],
    },
    "task_based": {
        "lure": [
            [
                "{victim_name} received a message on a messaging app offering paid 'like and subscribe' tasks with daily payouts.",
                "An advertisement promising part-time income for simple online tasks led {victim_name} to join a task-based earning group.",
                "{victim_name}, then unemployed, was recruited into a task-completion scheme through a message forwarded by an acquaintance.",
                "The complainant {victim_name} was invited to a group offering 'app rating' tasks with an initial payout structure designed to build trust.",
                "{victim_name} was contacted by a recruiter offering flexible work-from-home tasks with same-day payment for the earliest assignments.",
            ],
            [
                "The message was sent from the number {phone}.",
                "The group administrator could be reached at {phone}.",
                "The recruiter's number was {phone}.",
                "{victim_name} completed the first few tasks and received small payouts credited instantly.",
                "The scheme was based in {location}, according to the recruiter's own account.",
            ],
        ],
        "deposit": [
            [
                "After completing several small paid tasks, {victim_name} was asked to deposit funds to unlock a 'premium task set' with higher payouts.",
                "{victim_name} was told that a refundable 'registration deposit' was required to access higher-value tasks.",
                "The task coordinator instructed {victim_name} to transfer funds to reverse a supposed negative balance caused by a 'wrongly completed' task.",
                "{victim_name} made repeated transfers in order to remain eligible for the promised task payouts.",
                "{victim_name} was asked to pay a 'penalty clearance' fee after being falsely told a task deadline had been missed.",
            ],
            [
                "Rs. {amount} was transferred to account {account_ref}.",
                "The transfer of Rs. {amount} to account {account_ref} was made during a call from {phone}.",
                "{victim_name} sent Rs. {amount} to account {account_ref} in total across the scheme.",
                "The demand for Rs. {amount}, sent to account {account_ref}, was communicated via a call from {phone}.",
                "A final payment of Rs. {amount} was made to account {account_ref} before contact ceased.",
            ],
        ],
        "lockout": [
            [
                "Despite completing the required deposit, {victim_name} was unable to withdraw any earnings.",
                "{victim_name}'s account on the task platform was suddenly deactivated.",
                "The withdrawal request placed by {victim_name} remained pending indefinitely.",
                "{victim_name} found that all group administrators had become unreachable shortly after the final transfer.",
                "The task platform's application was found to be non-functional shortly after the last payment.",
            ],
            [
                "The task-assignment group was deleted, along with the contact number {phone} used throughout.",
                "No response was received from the coordinators, including at the number {phone} previously used to assign tasks.",
                "Further deposits were demanded before any release of funds, which {victim_name} refused.",
                "The last known contact number for the scheme was {phone}.",
                "{victim_name} could no longer access any record of the completed tasks or promised payouts.",
            ],
        ],
    },
    "loan_app": {
        "lure": [
            [
                "{victim_name} downloaded an instant-loan mobile application after seeing an advertisement promising approval within minutes.",
                "{victim_name}, facing urgent expenses, applied for a small personal loan through an unregistered lending application.",
                "The complainant {victim_name} was approved for a small loan instantly after granting the application extensive access to contacts and files on the phone.",
                "{victim_name}, based in {location}, was targeted with messages offering pre-approved instant loans with minimal eligibility criteria.",
                "{victim_name} installed a loan application recommended in a forwarded message promising same-day disbursal with no credit check.",
            ],
            [
                "The message was sent from the number {phone}.",
                "The message included a contact number, {phone}, for 'loan queries'.",
                "No formal documentation was requested at the time of disbursal.",
                "The application was not found to be registered with any recognized lending institution.",
                "{victim_name} was approved within minutes of submitting basic personal details.",
            ],
        ],
        "deposit": [
            [
                "After disbursing a small loan amount, the application began demanding a 'processing fee' before releasing the remaining sanctioned amount.",
                "{victim_name} was asked to pay GST and insurance charges despite these supposedly already having been deducted from the loan amount.",
                "The lender demanded an advance repayment citing a data-verification error on {victim_name}'s application.",
                "{victim_name} was threatened with inflated penalty interest for an alleged missed installment.",
                "To stop harassment calls, {victim_name} paid an additional amount described by the caller as a one-time settlement charge.",
            ],
            [
                "Rs. {amount} was transferred to account {account_ref}, communicated over a call from {phone}.",
                "{victim_name} paid Rs. {amount} to account {account_ref} following a call threatening account suspension.",
                "The demand for Rs. {amount}, sent to account {account_ref}, was raised during a call from {phone}.",
                "{victim_name} transferred Rs. {amount} to account {account_ref} after repeated threatening calls.",
                "A final payment of Rs. {amount} was made to account {account_ref}, which had been demanded from {phone}.",
            ],
        ],
        "lockout": [
            [
                "Despite the payment, {victim_name} continued to receive harassment calls and threats of morphed-photo circulation to contacts extracted from the phone.",
                "{victim_name}'s loan account balance was found to have increased rather than decreased after the payment.",
                "The loan application became inaccessible shortly after the payment was made.",
                "{victim_name} discovered that the loan had never been formally registered with any recognized lending institution.",
                "Recovery agents continued contacting {victim_name}'s family members and colleagues despite the demanded payment having already been made.",
            ],
            [
                "The harassment calls came from the number {phone}.",
                "The customer support number, {phone}, was no longer reachable.",
                "Repeated collection calls continued to come from {phone} despite the payment.",
                "Recovery agents used the number {phone} to contact family members.",
                "No explanation was provided for the increased balance despite repeated attempts to contact the lender.",
            ],
        ],
    },
}
