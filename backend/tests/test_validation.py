"""Input-validation tests for the EXISTING Pydantic models (no DB, no network).

Several tests intentionally document *current* permissive behaviour (marked
"current behaviour"). They are not endorsements; they pin today's contract so
any future tightening is a deliberate, visible change.
"""

import pytest
from pydantic import ValidationError

from models.patients import PatientCreate, PatientUpdate
from models.screenings import Lifestyle, ReferralUpdate, ScreeningCreate, Vitals

# --- PatientCreate ----------------------------------------------------------


def test_patient_create_minimal_valid_with_defaults():
    p = PatientCreate(name="Demo Person", age=40)
    assert (p.sex, p.community, p.phone) == ("female", "", "")


@pytest.mark.parametrize("missing", ["name", "age"])
def test_patient_create_required_fields(missing):
    data = {"name": "Demo Person", "age": 40}
    data.pop(missing)
    with pytest.raises(ValidationError):
        PatientCreate(**data)


@pytest.mark.parametrize("age", [0, 120])
def test_patient_age_bounds_accepted(age):
    assert PatientCreate(name="A", age=age).age == age


@pytest.mark.parametrize("age", [-1, 121, "abc", 45.5, None])
def test_patient_invalid_age_rejected(age):
    with pytest.raises(ValidationError):
        PatientCreate(name="A", age=age)


def test_patient_numeric_string_age_is_coerced():
    # current behaviour: Pydantic lax mode coerces "45" -> 45
    assert PatientCreate(name="A", age="45").age == 45


@pytest.mark.parametrize("name", ["", "x" * 121])
def test_patient_invalid_name_rejected(name):
    with pytest.raises(ValidationError):
        PatientCreate(name=name, age=30)


def test_patient_sex_is_free_text():
    # current behaviour: sex is not restricted to female/male/other
    assert PatientCreate(name="A", age=30, sex="unknown").sex == "unknown"


# --- PatientUpdate ----------------------------------------------------------


def test_patient_update_all_optional():
    assert PatientUpdate().model_dump(exclude_none=True) == {}


@pytest.mark.parametrize("data", [{"name": ""}, {"age": 200}, {"age": -3}, {"phone": "9" * 41}])
def test_patient_update_invalid_rejected(data):
    with pytest.raises(ValidationError):
        PatientUpdate(**data)


# --- Vitals -----------------------------------------------------------------


def test_vitals_all_optional():
    assert Vitals().model_dump() == {
        "systolic": None, "diastolic": None, "pulse": None,
        "weight_kg": None, "height_cm": None, "glucose": None,
    }


@pytest.mark.parametrize(
    ("field", "ok", "bad"),
    [
        ("systolic", [50, 300], [49, 301]),
        ("diastolic", [30, 200], [29, 201]),
        ("pulse", [30, 220], [29, 221]),
        ("glucose", [20, 700], [19, 701]),
        ("weight_kg", [0.1, 400], [0, 400.1, -1]),
        ("height_cm", [0.1, 260], [0, 260.5]),
    ],
)
def test_vitals_range_boundaries(field, ok, bad):
    for value in ok:
        assert getattr(Vitals(**{field: value}), field) == value
    for value in bad:
        with pytest.raises(ValidationError):
            Vitals(**{field: value})


@pytest.mark.parametrize("value", ["high", [120], {"v": 1}])
def test_vitals_wrong_types_rejected(value):
    with pytest.raises(ValidationError):
        Vitals(systolic=value)


def test_vitals_systolic_below_diastolic_accepted():
    # current behaviour: no cross-field plausibility check
    v = Vitals(systolic=80, diastolic=120)
    assert (v.systolic, v.diastolic) == (80, 120)


# --- Lifestyle --------------------------------------------------------------


def test_lifestyle_defaults():
    assert Lifestyle().model_dump() == {"smoker": False, "alcohol": False, "activity": "moderate"}


@pytest.mark.parametrize("activity", ["low", "moderate", "active"])
def test_lifestyle_valid_activity(activity):
    assert Lifestyle(activity=activity).activity == activity


@pytest.mark.parametrize("activity", ["sedentary", "", "LOW"])
def test_lifestyle_invalid_activity_rejected(activity):
    with pytest.raises(ValidationError):
        Lifestyle(activity=activity)


# --- ScreeningCreate --------------------------------------------------------


def test_screening_create_full_valid_submission():
    s = ScreeningCreate(
        new_patient_name="Demo Person", age=52, sex="female", community="Rampur",
        vitals={"systolic": 150, "diastolic": 95, "pulse": 88, "glucose": 160},
        lifestyle={"smoker": True, "alcohol": False, "activity": "low"},
        symptoms=["fatigue"], notes="synthetic",
    )
    assert s.vitals.systolic == 150 and s.lifestyle.activity == "low"


def test_screening_create_model_level_minimal_is_valid():
    # The patient-selector requirement is enforced by the route (422), not the model.
    s = ScreeningCreate()
    assert s.patient_id is None and s.new_patient_name is None and s.symptoms == []


@pytest.mark.parametrize(
    "data",
    [
        {"notes": "x" * 2001},
        {"age": 121},
        {"symptoms": "fever"},
        {"vitals": {"systolic": 10}},
        {"lifestyle": {"activity": "bad"}},
        {"new_patient_name": "x" * 121},
    ],
)
def test_screening_create_malformed_rejected(data):
    with pytest.raises(ValidationError):
        ScreeningCreate(**data)


# --- ReferralUpdate ---------------------------------------------------------


@pytest.mark.parametrize("status", ["none", "pending", "scheduled", "completed"])
def test_referral_valid_statuses(status):
    assert ReferralUpdate(referral_status=status).referral_status == status


@pytest.mark.parametrize("status", ["done", "", "PENDING"])
def test_referral_invalid_status_rejected(status):
    with pytest.raises(ValidationError):
        ReferralUpdate(referral_status=status)


def test_referral_status_required():
    with pytest.raises(ValidationError):
        ReferralUpdate()


@pytest.mark.parametrize("due", ["2026-11-30", "", None])
def test_referral_due_date_accepted(due):
    assert ReferralUpdate(referral_status="pending", referral_due_date=due).referral_due_date == due


@pytest.mark.parametrize("due", ["tomorrow", "2026-13-01", "30/11/2026", "2026-02-30"])
def test_referral_due_date_rejected(due):
    with pytest.raises(ValidationError):
        ReferralUpdate(referral_status="pending", referral_due_date=due)


def test_referral_coordinator_length_limit():
    with pytest.raises(ValidationError):
        ReferralUpdate(referral_status="pending", coordinator="x" * 121)
