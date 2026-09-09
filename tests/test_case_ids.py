from datetime import datetime, timezone

from app.api.case_ids import allocate_case_id


def test_allocate_case_id_starts_with_date_prefix():
    now = datetime(2026, 9, 10, tzinfo=timezone.utc)
    assert allocate_case_id(set(), now) == "NX-2026-0910"
    assert allocate_case_id({"NX-2026-0910"}, now) == "NX-2026-0910-02"
    assert allocate_case_id({"NX-2026-0910", "NX-2026-0910-02"}, now) == "NX-2026-0910-03"
