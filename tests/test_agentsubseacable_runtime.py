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


def test_appeal_fetch_failure_transition_and_bond_refund(client):
    """
    Focused test covering transition:
    Appeal with dead/unreachable URL -> AI Tribunal fails with APPEAL_UNRESOLVED_FETCH_FAILED ->
    Contract moves to STATUS_UNRESOLVED without stranding funds ->
    Appellant calls refund_dispute_bond ->
    100% dispute bond refunded, dispute_bond == 0, total_telecom_locked restored cleanly,
    status restored to STATUS_AWAITING_PAYOUT and prior verdict.
    """
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    escrow_amount = 2000000000000000000  # 2 GEN
    tx = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "AAG-TRANS-PACIFIC-FOC", 100, 5000],
        value=escrow_amount
    )
    pid = str(tx.return_value)

    # Carrier triggers initial outage alert
    telemetry_url = "https://atlas.ripe.net/api/v2/measurements/aag_fiber_severance.json"
    contract.connect(carrier).trigger_cable_outage_alert(args=[pid, telemetry_url])

    # AI Jury initial verdict: SLA breach
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "OUTAGE_SLA_BREACH_COMPENSATED",
                    "confidence": 92,
                    "cable_system_id": "AAG-TRANS-PACIFIC-FOC",
                    "measured_latency_ms": 4500,
                    "detected_magnitude_richter": 0,
                    "reason": "Complete optical backscatter attenuation detected. Zero seismic disturbance."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"cable": "AAG-TRANS-PACIFIC-FOC", "rtt": 4500}'}
            }
        }
    )
    contract.connect(carrier).adjudicate_cable_outage(args=[pid])

    p1 = json.loads(contract.get_policy(args=[pid]).call())
    assert p1["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p1["verdict"] == "OUTAGE_SLA_BREACH_COMPENSATED"

    # Operator files appeal within cooling-off with a dead/unreachable 404 URL
    dead_supp_url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&status=404_not_found"
    bond_amount = 200000000000000000  # 10% = 0.2 GEN
    contract.connect(operator).appeal_verdict(
        args=[pid, "Contesting initial verdict with supplementary seabed seismogram records.", dead_supp_url],
        value=bond_amount
    )

    p_disp = json.loads(contract.get_policy(args=[pid]).call())
    assert p_disp["status"] == 6  # STATUS_DISPUTED
    assert int(p_disp["dispute_bond"]) == bond_amount

    stats_disp = json.loads(contract.get_stats().call())
    assert int(stats_disp["total_telecom_locked"]) == escrow_amount + bond_amount

    # Attempt to adjudicate appeal with unreachable endpoint (mock returns empty body)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "web_mocks": {dead_supp_url: {"status": 404, "body": ""}}
        }
    )
    contract.connect(operator).adjudicate_appeal(args=[pid])

    # Verify policy transitions safely to STATUS_UNRESOLVED without stranding or losing dispute bond
    p_unresolved = json.loads(contract.get_policy(args=[pid]).call())
    assert p_unresolved["status"] == 8  # STATUS_UNRESOLVED
    assert p_unresolved["verdict"] == "APPEAL_UNRESOLVED_FETCH_FAILED"
    assert int(p_unresolved["dispute_bond"]) == bond_amount  # Bond preserved intact

    # Appellant exercises refund_dispute_bond
    contract.connect(operator).refund_dispute_bond(args=[pid])

    # Verify: 100% bond refunded, dispute_bond reset to 0, total_telecom_locked decremented correctly,
    # and status restored to STATUS_AWAITING_PAYOUT with prior verdict
    p_refunded = json.loads(contract.get_policy(args=[pid]).call())
    assert p_refunded["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_refunded["verdict"] == "OUTAGE_SLA_BREACH_COMPENSATED"
    assert int(p_refunded["dispute_bond"]) == 0

    stats_after = json.loads(contract.get_stats().call())
    assert int(stats_after["total_telecom_locked"]) == escrow_amount  # Cleanly reduced by bond_amount!

    # Verify claimable balance contains 100% refunded dispute bond
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == bond_amount

    # Appellant withdraws refunded bond via Pull-Payment
    contract.connect(operator).claim_payout()
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == 0
    assert int(contract.get_total_withdrawn(args=[str(operator)]).call()) == bond_amount


def test_appeal_retry_with_updated_evidence_url_succeeds(client):
    """
    Focused test covering appeal retry path:
    Appeal starts with dead URL -> fails to STATUS_UNRESOLVED ->
    Appellant retries adjudicate_appeal providing a new valid URL ->
    AI Appellate Tribunal executes consensus and successfully settles the dispute.
    """
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    escrow_amount = 3000000000000000000  # 3 GEN
    tx = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "SEA-ME-WE-6-S1", 95, 5000],
        value=escrow_amount
    )
    pid = str(tx.return_value)

    telemetry_url = "https://atlas.ripe.net/api/v2/measurements/smw6_outage.json"
    contract.connect(carrier).trigger_cable_outage_alert(args=[pid, telemetry_url])

    # Initial AI adjudication -> Outage SLA Breach
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "OUTAGE_SLA_BREACH_COMPENSATED",
                    "confidence": 95,
                    "cable_system_id": "SEA-ME-WE-6-S1",
                    "measured_latency_ms": 3000,
                    "detected_magnitude_richter": 0,
                    "reason": "Repeater segment unreachable in Indian Ocean corridor."
                })
            },
            "web_mocks": {telemetry_url: {"status": 200, "body": '{"cable": "SEA-ME-WE-6-S1", "down": true}'}}
        }
    )
    contract.connect(carrier).adjudicate_cable_outage(args=[pid])

    # Operator files appeal with dead URL
    dead_url = "https://earthquake.usgs.gov/broken_link_404.json"
    bond_amount = 300000000000000000  # 0.3 GEN
    contract.connect(operator).appeal_verdict(
        args=[pid, "Underwater earthquake caused submarine landslide.", dead_url],
        value=bond_amount
    )

    client.provider.make_request(
        method="sim_installMocks",
        params={"web_mocks": {dead_url: {"status": 404, "body": ""}}}
    )
    contract.connect(operator).adjudicate_appeal(args=[pid])

    p_unres = json.loads(contract.get_policy(args=[pid]).call())
    assert p_unres["status"] == 8  # STATUS_UNRESOLVED
    assert p_unres["verdict"] == "APPEAL_UNRESOLVED_FETCH_FAILED"

    # Now appellant retries by providing a new valid URL with active seismic data
    live_valid_url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&magnitude=6.4"
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "APPEAL_UPHELD_FORCE_MAJEURE",
                    "measured_latency_ms": 3000,
                    "detected_magnitude_richter": 64,
                    "reason": "6.4 magnitude submarine tectonic event confirmed along cable trench. Excused."
                })
            },
            "web_mocks": {
                live_valid_url: {"status": 200, "body": '{"magnitude": 6.4, "trench": "Java Trench", "ts": 1760000000}'}
            }
        }
    )

    # Retry adjudicate_appeal with the new valid URL
    contract.connect(operator).adjudicate_appeal(args=[pid, live_valid_url])

    p_settled = json.loads(contract.get_policy(args=[pid]).call())
    assert p_settled["status"] == 5  # STATUS_SETTLED_FORCE_MAJEURE
    assert p_settled["verdict"] == "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
    assert int(p_settled["dispute_bond"]) == 0
    assert int(p_settled["escrow_amount"]) == 0

    # Operator receives both 100% escrow refund (3 GEN) and 100% bond refund (0.3 GEN) = 3.3 GEN
    total_expected = escrow_amount + bond_amount
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == total_expected


def test_contract_deployment_with_integer_address_arg(client):
    """
    Guarantees that deploying the contract with a 160-bit integer address argument
    (as serialized by GenLayer Studio: [312826998849709214553341560051459171502959144246])
    does not throw AttributeError: 'int' object has no attribute 'as_bytes'.
    """
    int_addr = 312826998849709214553341560051459171502959144246
    contract = client.deploy("contracts/contract.py", args=[int_addr])

    stats = json.loads(contract.get_stats().call())
    assert stats["owner"] == f"0x{int_addr:040x}".lower()
    assert int(stats["total_policies"]) == 0


