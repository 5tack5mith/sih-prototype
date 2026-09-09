from datetime import datetime


def allocate_case_id(existing_ids: set[str], now: datetime) -> str:
    """Generate NX-YYYY-MMDD, then NX-YYYY-MMDD-02, without using a client-supplied id."""
    prefix = f"NX-{now.year}-{now.month:02d}{now.day:02d}"
    if prefix not in existing_ids:
        return prefix
    sequence = 2
    while f"{prefix}-{sequence:02d}" in existing_ids:
        sequence += 1
    return f"{prefix}-{sequence:02d}"
