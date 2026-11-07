"""Migration 001 — assign the existing synthetic records to the demo organisation.

ADDITIVE ONLY: `$set` of envelope fields on docs that have no `org_id` yet. Nothing is
deleted or overwritten; response models ignore these fields, so API JSON is unchanged.
Idempotent. Roster ids come from /tmp/demo_accounts.json (synthetic Clerk test users).

Run:  cd /app/backend && python -m migrations.m001_assign_demo_org [--apply]
Without --apply it only reports what would change.
"""

import asyncio
import json
import sys

DEMO_ORG_ID = "org-avenea-demo"


def roster_from(accounts: dict) -> dict:
    return {
        "chw": accounts["community_health_worker"]["user_id"],
        "care_team": [accounts["nurse"]["user_id"], accounts["physician"]["user_id"]],
        "coordinator": accounts["care_coordinator"]["user_id"],
    }


async def migrate(db, roster: dict, *, apply: bool) -> dict:
    report = {"patients": 0, "screenings": 0, "memberships": 0}
    patients = await db.patients.find({"org_id": {"$exists": False}}, {"_id": 0, "id": 1}).to_list(10000)
    screenings = await db.screenings.find({"org_id": {"$exists": False}}, {"_id": 0, "id": 1, "patient_id": 1, "referral_status": 1}).to_list(10000)
    referred = {s["patient_id"] for s in screenings if s.get("referral_status") != "none"}
    report["patients"], report["screenings"] = len(patients), len(screenings)
    if not apply:
        return report
    base = {"org_id": DEMO_ORG_ID, "assigned_worker_ids": [roster["chw"]], "care_team_ids": roster["care_team"]}
    for p in patients:
        extra = {"referral_coordinator_ids": [roster["coordinator"]] if p["id"] in referred else []}
        await db.patients.update_one({"id": p["id"], "org_id": {"$exists": False}}, {"$set": {**base, **extra}})
    for s in screenings:
        extra = {"coordinator_user_id": roster["coordinator"]} if s.get("referral_status") != "none" else {}
        await db.screenings.update_one({"id": s["id"], "org_id": {"$exists": False}}, {"$set": {**base, **extra}})
    await db.auth_orgs.update_one(
        {"id": DEMO_ORG_ID},
        {"$setOnInsert": {"id": DEMO_ORG_ID, "name": "Avenea Demo Organisation (synthetic)",
                          "default_worker_ids": [roster["chw"]], "default_care_team_ids": roster["care_team"],
                          "default_coordinator_id": roster["coordinator"]}},
        upsert=True,
    )
    roles = [(roster["chw"], "community_health_worker"), (roster["care_team"][0], "nurse"),
             (roster["care_team"][1], "physician"), (roster["coordinator"], "care_coordinator")]
    for uid, role in roles:
        r = await db.auth_memberships.update_one(
            {"user_id": uid, "org_id": DEMO_ORG_ID},
            {"$setOnInsert": {"user_id": uid, "org_id": DEMO_ORG_ID, "role": role, "status": "active"}}, upsert=True)
        report["memberships"] += 1 if r.upserted_id else 0
    await db.auth_memberships.create_index([("user_id", 1), ("org_id", 1)], unique=True, name="user_org")
    return report


if __name__ == "__main__":
    from lib.db import db

    roster = roster_from(json.load(open("/tmp/demo_accounts.json")))
    print(asyncio.run(migrate(db, roster, apply="--apply" in sys.argv)))
