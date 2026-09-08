"""
Entity factory functions: Person, Account, Phone, Recruiter platform,
Crypto exit node. Matches schema spec Section 2.

Every entity gets a globally unique ID via the counters below, since
Phase C combines many independently-generated cases into one graph and
IDs must not collide across cases.

Every factory takes an explicit `rng: random.Random` parameter and draws
only from it - no bare `random.*` calls - so a caller's choice of rng
(e.g. entity_attribute_rng for case entities, noise_rng for background
entities) fully determines and isolates this function's randomness.
"""

import itertools

from config import (
    BANK_TIERS,
    COMPLICIT_OCCUPATION_POOL,
    INDIAN_STATES_HIGH_RISK,
    OCCUPATIONS,
    RECRUITMENT_CHANNELS,
    STATE_DISTRICTS,
)

_person_counter = itertools.count(1)
_account_counter = itertools.count(1)
_phone_counter = itertools.count(1)
_org_counter = itertools.count(1)
_exit_counter = itertools.count(1)

# ASSUMPTION: curated common Indian first/last names spanning multiple
# linguistic regions (Hindi-belt, Punjabi, Bengali, Marathi, Gujarati,
# Tamil, Telugu, Kannada, Malayalam, Odia) - not an exhaustive or
# demographically-weighted list, just enough real names (120 x 100 =
# 12,000 combinations) that a ~3,000-person dataset doesn't force
# collisions the way the previous 16 x 16 = 256-combination pool did.
FIRST_NAMES = [
    "Amit", "Priya", "Ravi", "Sunita", "Vijay", "Anjali", "Rahul", "Pooja",
    "Suresh", "Kavita", "Manoj", "Deepa", "Arjun", "Neha", "Sanjay", "Rekha",
    "Rohit", "Sneha", "Vikas", "Anita", "Ashok", "Meena", "Deepak", "Shalini",
    "Ramesh", "Geeta", "Naveen", "Swati", "Kiran", "Poonam", "Rajesh", "Nisha",
    "Ajay", "Ritu", "Anil", "Seema", "Prakash", "Usha", "Vinod", "Manju",
    "Ashwin", "Divya", "Karan", "Isha", "Aakash", "Simran", "Varun", "Preeti",
    "Nikhil", "Shreya", "Gaurav", "Priyanka", "Abhishek", "Kritika", "Yogesh",
    "Sarita", "Mahesh", "Radha", "Sunil", "Jyoti", "Vivek", "Alka", "Harsh",
    "Payal", "Amar", "Lata", "Dinesh", "Vandana", "Girish", "Bhavna", "Naresh",
    "Chitra", "Mukesh", "Rani", "Satish", "Suman", "Raju", "Kamla", "Vishal",
    "Renu", "Sandeep", "Archana", "Pankaj", "Nidhi", "Manish", "Shweta",
    "Rakesh", "Madhuri", "Anand", "Sonal", "Devendra", "Aarti", "Jitendra",
    "Vidya", "Balaji", "Lakshmi", "Karthik", "Meenakshi", "Arun", "Kalyani",
    "Murali", "Vasanthi", "Rajan", "Padma", "Senthil", "Kavya", "Prasad",
    "Uma", "Venkat", "Latha", "Ganesh", "Saraswati", "Mohan", "Shanti",
    "Bharat", "Indira", "Krishnan", "Malathi", "Raghav", "Deepika",
    "Siddharth", "Ananya", "Aditya", "Farhan", "Ayesha",
]
LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Reddy", "Singh", "Kumar", "Gupta", "Nair",
    "Iyer", "Das", "Mehta", "Joshi", "Rao", "Chauhan", "Yadav", "Pillai",
    "Agarwal", "Bhatt", "Chatterjee", "Desai", "Ghosh", "Iyengar", "Jain",
    "Kapoor", "Krishnan", "Malhotra", "Menon", "Mishra", "Mukherjee", "Nayak",
    "Pandey", "Pandit", "Panicker", "Pathak", "Rajan", "Rathore", "Saxena",
    "Sengupta", "Shah", "Shetty", "Shukla", "Sinha", "Srinivasan", "Subramaniam",
    "Thakur", "Tiwari", "Trivedi", "Venkatesh", "Bose", "Chakraborty", "Dutta",
    "Goel", "Goyal", "Grover", "Jha", "Kaur", "Khanna", "Kohli", "Lal",
    "Mahajan", "Mahato", "Mistry", "Naidu", "Oberoi", "Prasad", "Puri",
    "Raghunathan", "Rana", "Ranganathan", "Sethi", "Suri", "Tandon", "Varma",
    "Vora", "Ahuja", "Anand", "Bajaj", "Balakrishnan", "Bedi", "Bhagat",
    "Chandran", "Chopra", "Dixit", "Dubey", "Gill", "Hegde", "Kannan",
    "Kaushik", "Konda", "Lakshman", "Mane", "Naik", "Pai", "Rawat",
    "Sarkar", "Soni", "Talwar", "Vaidya", "Vasudevan", "Warrier",
]


def _random_name(rng):
    return f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"


def _choose_occupation(rng, mule_type):
    """Schema Sec. 5: complicit mules should show occupation disconnected
    from their actual transaction volume (a student/unemployed account
    moving lakhs) - previously stated_occupation was drawn fully
    independently of mule_type, so this documented signal was never
    actually visible anywhere. Complicit mules now skew (70% of the time)
    toward lower-income-presenting occupations specifically to make that
    mismatch a real, visible signal rather than only the existing hidden
    economic_profile_deviation_score number."""
    if mule_type == "complicit" and rng.random() < 0.7:
        return rng.choice(COMPLICIT_OCCUPATION_POOL)
    return rng.choice(OCCUPATIONS)


def make_person(rng, role, mule_type=None, recruitment_channel=None):
    """role: victim | mule | mastermind | recruiter_operator | legitimate"""
    pid = f"P-{next(_person_counter):05d}"
    is_complicit = mule_type == "complicit"
    state = rng.choice(INDIAN_STATES_HIGH_RISK)
    return {
        "id": pid,
        "type": "PERSON",
        "canonical_name": _random_name(rng),
        "aliases": [],
        "visible": {
            "stated_occupation": _choose_occupation(rng, mule_type),
            "state": state,
            "district": rng.choice(STATE_DISTRICTS[state]),
            "district_risk_tier": rng.choice(["high", "medium", "low"]),
        },
        "ground_truth": {
            "role": role,
            "mule_type": mule_type,
            "recruitment_channel": recruitment_channel,
            # complicit mules show a bigger deviation between profile and
            # transaction behaviour than deceived/synthetic ones (schema Sec. 5)
            "economic_profile_deviation_score": round(rng.uniform(0.4, 0.95), 2)
            if is_complicit else round(rng.uniform(0.0, 0.3), 2),
        },
        "source_docs": [],
    }


def make_account(rng, person_id, mule_layer=None, is_exit_node=False, opened_via_bc=False,
                  kyc_status="verified", account_age_days=None):
    aid = f"A-{next(_account_counter):05d}"
    if account_age_days is None:
        # mule accounts skew new; legitimate accounts skew old
        account_age_days = rng.randint(5, 30) if mule_layer else rng.randint(180, 2000)
    return {
        "id": aid,
        "type": "ACCOUNT",
        "linked_person_id": person_id,
        "visible": {
            "account_age_days": account_age_days,
            "kyc_status": kyc_status,
            "bank_tier": rng.choice(BANK_TIERS),
            "opened_via_bc": opened_via_bc,
        },
        "ground_truth": {
            "mule_layer": mule_layer,
            "is_exit_node": is_exit_node,
        },
    }


def make_phone(rng, person_id):
    # Plain 10-digit Indian mobile format, no +91 prefix or separators:
    # first digit in {6,7,8,9} (the valid leading digits), the rest
    # uniform. Not enforced globally unique - with 4*10**9 possible values
    # against a dataset of a few hundred phones, collision odds are
    # negligible, and the spec only calls for plausible-unique, not
    # guaranteed-unique.
    phone_number = rng.choice("6789") + "".join(str(rng.randint(0, 9)) for _ in range(9))
    return {
        "id": f"PH-{next(_phone_counter):05d}",
        "type": "PHONE",
        "linked_person_id": person_id,
        # phone_number lives under "visible" (not top-level, alongside id)
        # because it is exactly the kind of fact an investigation would
        # actually observe (it's what appears in the FIR text) - consistent
        # with every other entity's visible/ground_truth split in this file.
        "visible": {"sim_registered_days": rng.randint(1, 3000), "phone_number": phone_number},
    }


def make_recruiter_platform(rng, channel=None):
    return {
        "id": f"ORG-{next(_org_counter):05d}",
        "type": "RECRUITER_PLATFORM",
        "visible": {
            "channel": channel or rng.choice(RECRUITMENT_CHANNELS),
            "pretext": rng.choice(["job_offer", "task_reward", "investment_lead"]),
        },
    }


def make_crypto_exit(rng):
    return {
        "id": f"EXIT-{next(_exit_counter):05d}",
        "type": "CRYPTO_OFFRAMP",
        "visible": {"platform_type": rng.choice(["p2p_exchange", "wallet_service"])},
    }
