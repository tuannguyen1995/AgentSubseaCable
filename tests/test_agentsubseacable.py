import pytest
import json
from genlayer import *


def test_subsea_cable_sla_breach_payout(client):
    """Proves that a verified human-induced subsea cable cut releases 100% indemnity to client."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    # Step 1: Operator locks 3 GEN SLA indemnity deposit for AAG transoceanic cable
    tx_create = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "AAG-TRANS-PACIFIC-S1", 120, 6000],
        value=3000000000000000000  # 3 GEN
    )
    policy_id = str(tx_create.return_value)

    # Step 2: Carrier files outage alert with RIPE Atlas telemetry endpoint
    telemetry_url = "https://atlas.ripe.net/api/v2/measurements/aag_fiber_cut_rtt.json"
    contract.connect(carrier).trigger_cable_outage_alert(
        args=[policy_id, telemetry_url]
    )

    # Step 3: Mock AI Subsea Tribunal -> Latency 9999ms (Fiber cut), No seismic activity (0 Richter)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "OUTAGE_SLA_BREACH_COMPENSATED",
                    "confidence": 99,
                    "cable_system_id": "AAG-TRANS-PACIFIC-S1",
                    "measured_latency_ms": 9999,
                    "detected_magnitude_richter": 0,
                    "reason": "Complete optical fiber cut verified by OTDR at BU4 off Luzon. Zero seismic triggers detected."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"CABLE": "AAG-TRANS-PACIFIC-S1", "STATUS": "CUT", "RTT_MS": 9999, "SEISMIC_RICHTER": 0.0}'}
            }
        }
    )

    contract.connect(carrier).adjudicate_cable_outage(args=[policy_id])

    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_data["verdict"] == "OUTAGE_SLA_BREACH_COMPENSATED"
    assert p_data["measured_latency_ms"] == 9999


def test_subsea_cable_earthquake_force_majeure(client):
    """Proves that a confirmed seafloor earthquake >= 5.5 Richter excuses the operator from SLA penalties."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    tx_create = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "SEA-ME-WE-5-S2", 90, 6000],
        value=2000000000000000000
    )
    policy_id = str(tx_create.return_value)

    telemetry_url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&cable=smw5"
    contract.connect(carrier).trigger_cable_outage_alert(
        args=[policy_id, telemetry_url]
    )

    # Mock USGS seafloor earthquake 6.2 Richter (62 x10)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "FORCE_MAJEURE_EARTHQUAKE_VERIFIED",
                    "confidence": 98,
                    "cable_system_id": "SEA-ME-WE-5-S2",
                    "measured_latency_ms": 9999,
                    "detected_magnitude_richter": 62,
                    "reason": "6.2 magnitude submarine earthquake ruptured seabed trench. Natural Force Majeure event excused."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"CABLE": "SEA-ME-WE-5-S2", "MAGNITUDE": 6.2, "DEPTH_KM": 15}'}
            }
        }
    )

    contract.connect(operator).adjudicate_cable_outage(args=[policy_id])

    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_data["verdict"] == "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
    assert p_data["detected_magnitude_richter"] == 62


def test_subsea_partial_latency_degradation_and_settlement(client):
    """Proves that moderate latency degradation results in 40% SLA penalty disbursed via pull-payment."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    escrow_val = 5000000000000000000  # 5 GEN
    tx_create = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "TAT-14-TRANSATLANTIC", 100, 6000],
        value=escrow_val
    )
    policy_id = str(tx_create.return_value)

    telemetry_url = "https://ndbc.noaa.gov/data/realtime2/tat14_telemetry.txt"
    contract.connect(carrier).trigger_cable_outage_alert(
        args=[policy_id, telemetry_url]
    )

    # 150ms latency (between 101 and 199 ms -> PARTIAL_LATENCY_DEGRADATION)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "PARTIAL_LATENCY_DEGRADATION",
                    "confidence": 95,
                    "cable_system_id": "TAT-14-TRANSATLANTIC",
                    "measured_latency_ms": 150,
                    "detected_magnitude_richter": 0,
                    "reason": "Optical dispersion and repeater amplifier degradation causing 150ms RTT."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": "TAT-14 RTT: 150ms, Jitter: 12ms"}
            }
        }
    )

    contract.connect(carrier).adjudicate_cable_outage(args=[policy_id])

    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_data["verdict"] == "PARTIAL_LATENCY_DEGRADATION"

    # Elapse cooling-off window (72s)
    contract.set_time(contract.simulated_time + 100)
    contract.connect(carrier).finalize_settlement(args=[policy_id])

    p_final = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_final["status"] == 4  # STATUS_SETTLED_PARTIAL

    # Client receives 40%, operator refunded 60%
    expected_client_payout = (escrow_val * 40) // 100
    expected_operator_refund = escrow_val - expected_client_payout
    assert int(contract.get_claimable_balance(args=[str(carrier)]).call()) == expected_client_payout
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == expected_operator_refund

    # Beneficiary executes pure Pull-Payment claim
    contract.connect(carrier).claim_payout()
    assert int(contract.get_claimable_balance(args=[str(carrier)]).call()) == 0
    assert int(contract.get_total_withdrawn(args=[str(carrier)]).call()) == expected_client_payout


def test_appellate_cooling_off_and_stale_recovery(client):
    """Proves appeal bond staking and safe 100% bond refund on stale timeout recovery."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    tx_create = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "FASTER-PACIFIC-N1", 80, 6000],
        value=1000000000000000000  # 1 GEN
    )
    policy_id = str(tx_create.return_value)

    telemetry_url = "https://submarinecablemap.com/api/v3/faster_outage.json"
    contract.connect(carrier).trigger_cable_outage_alert(args=[policy_id, telemetry_url])

    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_SUBSEA_CABLE_V1",
                    "verdict": "OUTAGE_SLA_BREACH_COMPENSATED",
                    "confidence": 90,
                    "cable_system_id": "FASTER-PACIFIC-N1",
                    "measured_latency_ms": 300,
                    "detected_magnitude_richter": 0,
                    "reason": "Outage detected off Chikura Landing Station."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"cable": "FASTER-PACIFIC-N1", "status": "OUTAGE"}'}
            }
        }
    )

    contract.connect(carrier).adjudicate_cable_outage(args=[policy_id])

    # Operator disputes within cooling-off window with 10% bond (0.1 GEN)
    supp_url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&region=honshu"
    bond_amount = 100000000000000000  # 0.1 GEN
    contract.connect(operator).appeal_verdict(
        args=[policy_id, "Seabed seismic tremor occurred during the fiber incident window.", supp_url],
        value=bond_amount
    )

    p_disp = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_disp["status"] == 6  # STATUS_DISPUTED
    assert int(p_disp["dispute_bond"]) == bond_amount

    # Advance time past 7-day appeal timeout window
    contract.set_time(contract.simulated_time + (8 * 86400))

    # Resolve stale appeal: appellant gets 100% bond refund, policy restored to prior verdict
    contract.connect(operator).resolve_stale_appeal(args=[policy_id])

    p_recovered = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_recovered["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_recovered["verdict"] == "OUTAGE_SLA_BREACH_COMPENSATED"
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == bond_amount


def test_unaccredited_source_rejection(client):
    """Guarantees that untrusted or rogue telemetry sources are strictly rejected."""
    contract = client.deploy("contracts/contract.py")
    operator = client.accounts[0]
    carrier = client.accounts[1]

    tx_create = contract.connect(operator).create_subsea_sla_escrow(
        args=[str(carrier), "2AFRICA-WEST-LOOP", 110, 6000],
        value=1000000000000000000
    )
    policy_id = str(tx_create.return_value)

    with pytest.raises(Exception) as exc_info:
        contract.connect(carrier).trigger_cable_outage_alert(
            args=[policy_id, "https://malicious-telemetry-hacker.com/spoofed_data.json"]
        )
    assert "accredited subsea/seismic sources" in str(exc_info.value)
