"""tscheck: live backend enforcement against the real (non-isolated) demo DB, using real
Clerk session tokens for the demo accounts named in /app/memory/test_credentials.md.

Covers acceptance-matrix criterion "Backend enforcement (API)":
  - No token -> 401 on /api/patients, /api/screenings, /api/analytics/summary
  - CHW PATCH /api/screenings/{id}/referral -> 403
  - care_coordinator POST /api/screenings -> 403
  - care_coordinator GET /api/patients returns fewer rows than nurse
  - GET /api/patients/nope -> 404 {detail: 'patient not found'}

Clerk tokens are minted via the Backend API (session + token), each session token only used
within the test; the CLERK_SECRET_KEY is loaded from backend/.env and never logged.
"""

import os

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api"
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

USER_IDS = {
    "chw": "user_3LljmpCqYUZc4MYqbsA5pTCJuNH",
    "nurse": "user_3LljmklAHtxmfF8HaEjfURBVQ5t",
    "physician": "user_3Lljmj6VjRFOgU2OaqKmOmgaCpJ",
    "coordinator": "user_3LljmpEP9dBURHZxFfjAPnlX3Db",
}

pytestmark = pytest.mark.skipif(not CLERK_SECRET_KEY, reason="CLERK_SECRET_KEY not configured")


def _clerk_token(user_id: str) -> str:
    headers = {"Authorization": f"Bearer {CLERK_SECRET_KEY}", "User-Agent": "emergent-test"}
    with httpx.Client(base_url="https://api.clerk.com/v1", timeout=30.0, headers=headers) as c:
        sess = c.post("/sessions", json={"user_id": user_id})
        assert sess.status_code < 300, sess.text
        session_id = sess.json()["id"]
        tok = c.post(f"/sessions/{session_id}/tokens", json={"expires_in_seconds": 600})
        assert tok.status_code < 300, tok.text
        return tok.json()["jwt"]


@pytest.fixture(scope="module")
def tokens():
    return {role: _clerk_token(uid) for role, uid in USER_IDS.items()}


@pytest.fixture(scope="module")
def http():
    with httpx.Client(base_url=API_URL, timeout=30.0) as c:
        yield c


@pytest.mark.parametrize("path", ["/patients", "/screenings", "/analytics/summary"])
def test_no_token_401(http, path):
    r = http.get(path)
    assert r.status_code == 401, f"{path} -> {r.status_code}: {r.text[:200]}"


def test_chw_cannot_update_referral_403(http, tokens):
    headers = {"Authorization": f"Bearer {tokens['chw']}"}
    scr = http.get("/screenings", headers=headers)
    assert scr.status_code == 200, scr.text[:200]
    rows = scr.json()
    assert rows, "expected at least one screening visible to chw"
    sid = rows[0]["id"]
    r = http.patch(f"/screenings/{sid}/referral", headers=headers, json={"referral_status": "scheduled"})
    assert r.status_code == 403, f"PATCH referral -> {r.status_code}: {r.text[:200]}"


def test_coordinator_cannot_create_screening_403(http, tokens):
    headers = {"Authorization": f"Bearer {tokens['coordinator']}"}
    body = {
        "patient_id": "tscheck-nonexistent",
        "vitals": {"bp_systolic": 120, "bp_diastolic": 80},
        "symptoms": [],
    }
    r = http.post("/screenings", headers=headers, json=body)
    assert r.status_code == 403, f"POST screenings -> {r.status_code}: {r.text[:200]}"


def test_coordinator_sees_fewer_patients_than_nurse(http, tokens):
    nurse_r = http.get("/patients", headers={"Authorization": f"Bearer {tokens['nurse']}"})
    coord_r = http.get("/patients", headers={"Authorization": f"Bearer {tokens['coordinator']}"})
    assert nurse_r.status_code == 200, nurse_r.text[:200]
    assert coord_r.status_code == 200, coord_r.text[:200]
    nurse_count = len(nurse_r.json())
    coord_count = len(coord_r.json())
    assert coord_count < nurse_count, f"coordinator={coord_count} nurse={nurse_count}"
    assert nurse_count >= 14
    # Baseline seed is 9 coordinator-visible patients; browser E2E checks in this suite may add a
    # small number of their own high-risk "E2E Synthetic" referrals (coordinator-visible by design),
    # so assert >= baseline rather than an exact count that live-DB residue would make flaky.
    assert coord_count >= 9


def test_patient_not_found_404(http, tokens):
    headers = {"Authorization": f"Bearer {tokens['nurse']}"}
    r = http.get("/patients/nope", headers=headers)
    assert r.status_code == 404, f"-> {r.status_code}: {r.text[:200]}"
    assert r.json().get("detail") == "patient not found"
