import pytest
import json
from genlayer import *


def test_unresolved_telemetry_fetch_failure_preserves_state(client):
    """Verifies that an unreachable endpoint transitions to STATUS_UNRESOLVED without prematurely settling funds."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    tx = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "2AFRICA-EAST-LOOP", 100, 5000],
        value=1500000000000000000
    )
    pid = str(tx.return_value)

    # Empty web mock simulates unreachable/empty endpoint
    telemetry_url = "https://ripe.net/measurements/2africa_down.json"
    contract.connect(carrier).trigger_cable_outage_alert(args=[pid, telemetry_url])

    client.provider.make_request(
        method="sim_installMocks",
        params={
            "web_mocks": {telemetry_url: {"status": 500, "body": ""}}
        }
    )

    contract.connect(carrier).adjudicate_cable_outage(args=[pid])

    p = json.loads(contract.get_policy(args=[pid]).call())
    assert p["status"] == 8  # STATUS_UNRESOLVED
    assert p["verdict"] == "UNRESOLVED_FETCH_FAILED"
    # Escrow is preserved intact
    assert int(p["escrow_amount"]) == 1500000000000000000


def test_cancel_or_reclaim_clean_expiration(client):
    """Verifies operator can safely reclaim escrow after coverage duration concludes without disputes."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    escrow = 2000000000000000000
    tx = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "MAREA-TRANS-ATLANTIC", 60, 1000],  # 3000s duration
        value=escrow
    )
    pid = str(tx.return_value)

    # Fast forward past expiration
    contract.set_time(contract.simulated_time + 4000)

    contract.connect(operator).cancel_or_reclaim(args=[pid])

    p = json.loads(contract.get_policy(args=[pid]).call())
    assert p["status"] == 7  # STATUS_EXPIRED_RECLAIMED
    assert p["verdict"] == "EXPIRED_CLEAN"
    assert int(p["escrow_amount"]) == 0
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == escrow


def test_permission_and_role_checks(client):
    """Verifies that unauthorized actors cannot hijack alerts or adjudication."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]
    stranger = client.accounts[2]

    tx = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "APG-ASIA-PACIFIC-GATEWAY", 75, 4000],
        value=1000000000000000000
    )
    pid = str(tx.return_value)

    # Stranger tries to trigger alert
    telemetry_url = "https://atlas.ripe.net/apg.json"
    with pytest.raises(Exception) as exc_info:
        contract.connect(stranger).trigger_cable_outage_alert(args=[pid, telemetry_url])
    assert "Role Violation" in str(exc_info.value)

    # Carrier triggers valid alert
    contract.connect(carrier).trigger_cable_outage_alert(args=[pid, telemetry_url])

    # Stranger cannot adjudicate
    with pytest.raises(Exception) as exc_adj:
        contract.connect(stranger).adjudicate_cable_outage(args=[pid])
    assert "Permission Denied" in str(exc_adj.value)

    # Check roles
    assert contract.get_user_role(args=[pid, str(operator)]).call() == "OPERATOR"
    assert contract.get_user_role(args=[pid, str(carrier)]).call() == "CLIENT"
    assert contract.get_user_role(args=[pid, str(stranger)]).call() == "OBSERVER"


def test_stats_and_policy_views(client):
    """Verifies aggregated metrics and get_all_policies view."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "CABLE-A", 100, 3000],
        value=1000000000000000000
    )
    contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "CABLE-B", 120, 3000],
        value=2000000000000000000
    )

    stats = json.loads(contract.get_stats().call())
    assert stats["total_policies"] == 2
    assert int(stats["total_telecom_locked"]) == 3000000000000000000
    assert stats["total_policies_settled"] == 0

    all_policies = json.loads(contract.get_all_policies().call())
    assert len(all_policies) == 2
    assert all_policies[0]["cable_system_id"] == "CABLE-A"
    assert all_policies[1]["cable_system_id"] == "CABLE-B"
