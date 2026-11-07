"""Regression tests for the EXISTING Avenea demo heuristic `compute_risk()`.

These tests pin the current, experimental, rule-based scoring so that future
refactors cannot change it silently. Passing tests are NOT evidence of
clinical accuracy or validation; the heuristic is a labelled demo aid only.

Pure unit tests: no database, no network.
"""

from collections import Counter

import pytest

from models.screenings import Lifestyle, Vitals, compute_risk

NEUTRAL = Lifestyle(smoker=False, alcohol=False, activity="moderate")


def risk(age: int = 30, symptoms: list[str] | None = None, lifestyle: Lifestyle | None = None, **vitals):
    return compute_risk(Vitals(**vitals), lifestyle or NEUTRAL, symptoms or [], age)


# --- baseline ---------------------------------------------------------------


def test_all_normal_readings_score_zero_low():
    assert risk(systolic=118, diastolic=76, pulse=72, glucose=90) == (0, "low", [])


def test_empty_vitals_score_zero_low():
    assert risk() == (0, "low", [])


def test_deterministic_for_identical_input():
    kwargs = dict(age=63, symptoms=["fatigue"], systolic=150, diastolic=95, glucose=150)
    assert risk(**kwargs) == risk(**kwargs)


# --- blood pressure ---------------------------------------------------------

ELEVATED = "Elevated blood pressure"
SEVERE = "Severely elevated blood pressure"


@pytest.mark.parametrize(
    ("systolic", "diastolic", "points", "flag"),
    [
        (139, 89, 0, None),
        (140, 80, 2, ELEVATED),
        (120, 90, 2, ELEVATED),
        (159, 99, 2, ELEVATED),
        (160, 80, 3, SEVERE),
        (120, 100, 3, SEVERE),
        (300, 200, 3, SEVERE),
        (50, 30, 0, None),
    ],
)
def test_blood_pressure_boundaries(systolic, diastolic, points, flag):
    score, _, flags = risk(systolic=systolic, diastolic=diastolic)
    assert score == points
    assert flags == ([flag] if flag else [])


@pytest.mark.parametrize("vitals", [{"systolic": 220}, {"diastolic": 130}])
def test_blood_pressure_scored_only_when_both_values_present(vitals):
    # Current behaviour: a single BP reading contributes nothing.
    assert risk(**vitals) == (0, "low", [])


# --- glucose ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("glucose", "points", "flag"),
    [
        (139, 0, None),
        (140, 2, "Borderline fasting glucose"),
        (199, 2, "Borderline fasting glucose"),
        (200, 3, "High fasting glucose"),
        (700, 3, "High fasting glucose"),
        (20, 0, None),
    ],
)
def test_glucose_boundaries(glucose, points, flag):
    score, _, flags = risk(glucose=glucose)
    assert score == points
    assert flags == ([flag] if flag else [])


# --- pulse ------------------------------------------------------------------


@pytest.mark.parametrize(("pulse", "points"), [(100, 0), (101, 1), (220, 1)])
def test_pulse_boundary(pulse, points):
    score, _, flags = risk(pulse=pulse)
    assert score == points
    assert flags == (["Resting tachycardia"] if points else [])


# --- age --------------------------------------------------------------------


@pytest.mark.parametrize(("age", "points"), [(0, 0), (44, 0), (45, 1), (59, 1), (60, 2), (120, 2)])
def test_age_boundaries_add_points_without_flags(age, points):
    assert risk(age=age) == (points, "low", [])


def test_negative_age_is_not_rejected_by_compute_risk():
    # compute_risk itself does no validation; range checks live in the Pydantic models.
    assert risk(age=-5) == (0, "low", [])


# --- lifestyle --------------------------------------------------------------


@pytest.mark.parametrize(
    ("lifestyle", "points", "flags"),
    [
        (Lifestyle(smoker=True), 1, ["Tobacco use"]),
        (Lifestyle(alcohol=True), 1, ["Regular alcohol use"]),
        (Lifestyle(activity="low"), 1, ["Sedentary lifestyle"]),
        (Lifestyle(activity="moderate"), 0, []),
        (Lifestyle(activity="active"), 0, []),
        (
            Lifestyle(smoker=True, alcohol=True, activity="low"),
            3,
            ["Tobacco use", "Regular alcohol use", "Sedentary lifestyle"],
        ),
    ],
)
def test_lifestyle_factors(lifestyle, points, flags):
    assert risk(lifestyle=lifestyle) == (points, "low", flags)


# --- symptoms ---------------------------------------------------------------

RED_FLAG = "Red-flag symptom reported"


@pytest.mark.parametrize(
    ("symptoms", "points", "flags"),
    [
        (["fatigue"], 1, []),
        (["fatigue", "headache", "fever"], 3, []),
        (["fatigue", "headache", "fever", "dizziness", "swelling"], 3, []),  # capped at 3
        (["chest_pain"], 3, [RED_FLAG]),  # 1 + 2
        (["breathlessness"], 3, [RED_FLAG]),
        (["chest_pain", "breathlessness"], 4, [RED_FLAG]),  # 2 + 2, single flag
        (["fever", "fever"], 2, []),  # current behaviour: duplicates are counted
        (["not_a_known_symptom"], 1, []),  # current behaviour: keys are not validated
    ],
)
def test_symptom_scoring(symptoms, points, flags):
    assert risk(symptoms=symptoms) == (points, "low" if points < 4 else "moderate", flags)


# --- tier boundaries --------------------------------------------------------


def test_score_3_is_low():
    assert risk(age=60, lifestyle=Lifestyle(smoker=True))[:2] == (3, "low")


def test_score_4_is_moderate():
    assert risk(age=60, lifestyle=Lifestyle(smoker=True, alcohol=True))[:2] == (4, "moderate")


def test_score_6_is_moderate():
    score_level = risk(age=60, systolic=140, diastolic=80, lifestyle=Lifestyle(smoker=True, alcohol=True))[:2]
    assert score_level == (6, "moderate")


def test_score_7_is_high():
    lifestyle = Lifestyle(smoker=True, alcohol=True, activity="low")
    assert risk(age=60, systolic=140, diastolic=80, lifestyle=lifestyle)[:2] == (7, "high")


def test_maximum_score_and_flag_order():
    score, level, flags = risk(
        age=60,
        systolic=180,
        diastolic=110,
        glucose=250,
        pulse=120,
        lifestyle=Lifestyle(smoker=True, alcohol=True, activity="low"),
        symptoms=["chest_pain", "fatigue", "fever", "headache"],
    )
    assert (score, level) == (17, "high")
    assert flags == [
        SEVERE,
        "High fasting glucose",
        "Resting tachycardia",
        "Tobacco use",
        "Regular alcohol use",
        "Sedentary lifestyle",
        RED_FLAG,
    ]


# --- seed profiles snapshot -------------------------------------------------


def test_seed_profiles_produce_pinned_tier_distribution():
    """Pins the tiers of the 14 synthetic seed visits (reads seed constants only, no DB)."""
    from seed import PATIENTS

    levels = Counter()
    for entry in PATIENTS:
        for v in entry["visits"]:
            _, level, _ = compute_risk(
                Vitals(
                    systolic=v["sbp"], diastolic=v["dbp"], pulse=v["pulse"],
                    weight_kg=v["weight"], height_cm=v["height"], glucose=v["glucose"],
                ),
                Lifestyle(smoker=v["smoker"], alcohol=v["alcohol"], activity=v["activity"]),
                v["symptoms"],
                entry["age"],
            )
            levels[level] += 1
    assert sum(levels.values()) == 14
    assert levels == Counter({"low": 5, "moderate": 3, "high": 6})
