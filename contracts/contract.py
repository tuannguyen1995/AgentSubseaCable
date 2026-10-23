# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import hashlib

CANARY_TOKEN = "CANARY_AGENT_SUBSEA_CABLE_V1"

# Time & Cooling-Off Parameters
SECONDS_PER_BLOCK = 3
COOLING_OFF_BLOCKS = 24
COOLING_OFF_SECONDS = bigint(COOLING_OFF_BLOCKS * SECONDS_PER_BLOCK)  # 72 seconds
APPEAL_TIMEOUT_SECONDS = bigint(7 * 86400)                             # 7 days bounded appeal timeout
DEFAULT_POLICY_DURATION_SECONDS = bigint(86400 * 30)                  # 30 days coverage

# Lifecycle Statuses
STATUS_POLICY_OPEN = u8(0)           # Cable operator deposited SLA indemnity escrow
STATUS_ALERT_SUBMITTED = u8(1)       # Client submitted outage/OTDR telemetry
STATUS_AWAITING_PAYOUT = u8(2)       # AI Subsea Jury rendered verdict, cooling-off active
STATUS_SETTLED_SLA_BREACH = u8(3)    # SLA breach confirmed, 100% indemnity released to client
STATUS_SETTLED_PARTIAL = u8(4)       # Partial latency degradation penalty, 40% released
STATUS_SETTLED_FORCE_MAJEURE = u8(5) # Subsea seismic/earthquake verified, SLA penalty excused
STATUS_DISPUTED = u8(6)              # Under appellate review with 10% staked bond
STATUS_EXPIRED_RECLAIMED = u8(7)     # Policy expired without unresolved alerts, reclaimed by operator
STATUS_UNRESOLVED = u8(8)            # Telemetry fetch, parse, or canary failure (non-settling protected state)


class ContractError(Exception):
    """Domain-specific error for AgentSubseaCable protocol."""
    pass


def _to_address(val) -> Address:
    """Pass-through or safe conversion for Address in GenVM."""
    if isinstance(val, Address):
        return val
    return val


def _addr_str(addr) -> str:
    """Safely format an Address or address-like value into a lowercase hex string."""
    if addr is None:
        return "0x0000000000000000000000000000000000000000"
    if isinstance(addr, int):
        return f"0x{addr:040x}".lower()
    try:
        return addr.as_hex.lower()
    except Exception:
        return str(addr).lower()


def _get_sender() -> Address:
    """Safely obtain transaction sender across GenVM runtime versions."""
    try:
        return gl.message.sender_address
    except Exception:
        try:
            return gl.message.sender
        except Exception:
            raise ContractError("Cannot resolve sender address.")


ACCREDITED_SUBSEA_SOURCES = [
    "submarinecablemap.com",
    "telegeography.com",
    "earthquake.usgs.gov",
    "usgs.gov",
    "ndbc.noaa.gov",
    "noaa.gov",
    "ripe.net",
    "atlas.ripe.net",
    "emsc-csem.org",
    "isc.ac.uk",
]


def _is_accredited_subsea_source(url: str) -> bool:
    """Verifies that subsea telemetry originates strictly from accredited hydrographic, seismic, or network telemetry authorities."""
    clean = str(url).strip().lower()
    if not (clean.startswith("http://") or clean.startswith("https://")):
        return False
    try:
        no_proto = clean.split("://", 1)[1]
        host = no_proto.split("/", 1)[0].split(":", 1)[0]
        for domain in ACCREDITED_SUBSEA_SOURCES:
            if host == domain or host.endswith("." + domain):
                return True
    except Exception:
        return False
    return False


@allow_storage
@dataclass
class SubseaPolicy:
    policy_id: str
    cable_operator: Address        # Subsea consortium / Cable landing station operator
    client: Address                # Telecom carrier / Cloud provider buying capacity
    dispute_initiator: Address     # Appellant who staked bond
    escrow_amount: bigint          # Locked SLA indemnity funds
    dispute_bond: bigint           # 10% appeal stake
    cable_system_id: str           # Cable code (e.g., "AAG-TRANS-PACIFIC", "SEA-ME-WE-5")
    max_tolerable_latency_ms: u32  # Maximum agreed Round-Trip Time (RTT in ms)
    telemetry_feed_url: str        # Accredited OTDR / seismic / latency telemetry endpoint
    evidence_hash: str             # SHA-256 snapshot of combined technical payload
    status: u8
    verdict: str                   # "PENDING", "OUTAGE_SLA_BREACH_COMPENSATED", "PARTIAL_LATENCY_DEGRADATION", "FORCE_MAJEURE_EARTHQUAKE_VERIFIED", "DISPUTED", "UNRESOLVED_*"
    original_verdict: str          # Preserved pre-appeal verdict
    reason: str
    confidence: u8
    measured_latency_ms: u32       # Measured latency in ms during incident
    detected_magnitude_richter: u8 # Measured seismic magnitude (x10, e.g. 58 = 5.8 Richter)
    created_at_time: bigint        # Trusted Unix timestamp when policy was created
    expires_at_time: bigint        # Trusted Unix timestamp when coverage concludes
    audit_completed_time: bigint   # Trusted Unix timestamp when AI jury rendered verdict
    supplemental_evidence_url: str # Bound appellate evidence URL
    appeal_prior_verdict: str      # Verdict recorded before appeal was filed
    dispute_filed_time: bigint     # Timestamp when appellate dispute was staked


class Contract(gl.Contract):
    """
    AgentSubseaCable: Autonomous Transoceanic Fiber Optic Cable SLA & Seismic Risk Escrow
    Target Network: GenLayer StudioNet (Chain ID: 61999)
    """
    policies: TreeMap[str, SubseaPolicy]
    policy_ids: DynArray[str]
    total_telecom_locked: bigint
    total_policies_settled: u32
    policy_counter: u64
    owner: Address
    claimable_balances: TreeMap[str, bigint]
    total_pending_claims: bigint
    total_withdrawn_ledger: TreeMap[str, bigint]

    def __init__(self, initial_owner: Address = None):
        target_owner = initial_owner
        if target_owner is None:
            try:
                target_owner = _get_sender()
            except Exception:
                target_owner = None

        self.owner = target_owner
        self.total_telecom_locked = bigint(0)
        self.total_policies_settled = u32(0)
        self.policy_counter = u64(0)
        self.total_pending_claims = bigint(0)

    def _resolve_pid(self, policy_id) -> str:
        return str(policy_id).strip()

    def _ensure_owner(self) -> None:
        if self.owner is None or _addr_str(self.owner) == "0x0000000000000000000000000000000000000000":
            self.owner = _get_sender()

    def _credit_payout(self, recipient: Address, amount: bigint) -> None:
        """
        Pure Pull-Payment accounting:
        Credits beneficiary balance securely on-chain. Prevents loss of funds from transfer errors or reentrancy.
        """
        if amount <= bigint(0):
            return
        rec_str = _addr_str(_to_address(recipient))
        curr = self.claimable_balances.get(rec_str, bigint(0))
        self.claimable_balances[rec_str] = curr + amount
        self.total_pending_claims = self.total_pending_claims + amount

    def _get_current_timestamp(self) -> bigint:
        """Derives trusted Unix timestamp strictly from consensus context (gl.message_raw['datetime'])."""
        import calendar
        from datetime import datetime, timezone
        try:
            if hasattr(gl, "message_raw") and isinstance(gl.message_raw, dict):
                raw_val = gl.message_raw.get("datetime", "")
                if raw_val:
                    dt_str = str(raw_val).strip().replace("Z", "+00:00")
                    dt = datetime.fromisoformat(dt_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    ts = calendar.timegm(dt.utctimetuple())
                    if ts > 0:
                        return bigint(ts)
        except Exception:
            pass
        return bigint(1760000000)

    # ── Public Write Methods ──────────────────────────────────────────

    @gl.public.write.payable
    def create_subsea_sla_escrow(
        self,
        client: Address,
        cable_system_id: str,
        max_tolerable_latency_ms: u32,
        duration_blocks: u32
    ) -> str:
        """Cable operator locks SLA indemnity deposit guaranteeing transoceanic bandwidth continuity."""
        self._ensure_owner()
        escrow = bigint(gl.message.value)
        if escrow <= bigint(0):
            raise ContractError("SLA indemnity escrow deposit must be greater than 0 GEN.")

        clean_cable = str(cable_system_id).strip().upper()
        if len(clean_cable) < 4:
            raise ContractError("Valid cable system identifier required (>= 4 chars).")

        c_addr = _to_address(client)
        if _addr_str(c_addr) == "0x0000000000000000000000000000000000000000":
            raise ContractError("Valid client telecom carrier address required.")

        s_addr = _to_address(_get_sender())
        if _addr_str(s_addr) == _addr_str(c_addr):
            raise ContractError("Operator cannot designate themselves as client beneficiary.")

        dur_secs = bigint(int(duration_blocks) * 3 if int(duration_blocks) > 0 else int(DEFAULT_POLICY_DURATION_SECONDS))

        self.policy_counter = self.policy_counter + u64(1)
        policy_id = str(self.policy_counter)
        current_time = self._get_current_timestamp()
        expires_at = current_time + dur_secs

        new_policy = SubseaPolicy(
            policy_id=policy_id,
            cable_operator=s_addr,
            client=c_addr,
            dispute_initiator=s_addr,
            escrow_amount=escrow,
            dispute_bond=bigint(0),
            cable_system_id=clean_cable,
            max_tolerable_latency_ms=u32(int(max_tolerable_latency_ms)),
            telemetry_feed_url="",
            evidence_hash="",
            status=STATUS_POLICY_OPEN,
            verdict="PENDING",
            original_verdict="PENDING",
            reason="Subsea cable SLA active. Monitored for optical link continuity and subsea seismic anomalies.",
            confidence=u8(0),
            measured_latency_ms=u32(0),
            detected_magnitude_richter=u8(0),
            created_at_time=current_time,
            expires_at_time=expires_at,
            audit_completed_time=bigint(0),
            supplemental_evidence_url="",
            appeal_prior_verdict="",
            dispute_filed_time=bigint(0),
        )

        self.policies[policy_id] = new_policy
        self.policy_ids.append(policy_id)
        self.total_telecom_locked = self.total_telecom_locked + escrow
        return policy_id

    @gl.public.write
    def trigger_cable_outage_alert(
        self,
        policy_id: str,
        telemetry_feed_url: str
    ) -> None:
        """Client telecom submits verified OTDR telemetry or RIPE Atlas network outage endpoint."""
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_POLICY_OPEN, STATUS_UNRESOLVED):
            raise ContractError("Policy is not open for outage alert filing.")

        sender = _get_sender()
        if _addr_str(sender) != _addr_str(p.client):
            raise ContractError("Role Violation: Only registered client can file cable outage alert.")

        clean_url = str(telemetry_feed_url).strip()
        if not _is_accredited_subsea_source(clean_url):
            raise ContractError("Telemetry unauthenticated: Must originate from accredited subsea/seismic sources (Submarine Cable Map, USGS, NOAA, RIPE).")

        current_time = self._get_current_timestamp()
        if current_time > p.expires_at_time:
            raise ContractError("Coverage duration for this subsea SLA policy has expired.")

        p.telemetry_feed_url = clean_url
        p.status = STATUS_ALERT_SUBMITTED
        p.reason = "Subsea fiber outage telemetry filed. Ready for on-chain AI Astroseismic & SLA Tribunal verification."

    @gl.public.write
    def adjudicate_cable_outage(self, policy_id: str) -> None:
        """
        AI Subsea Tribunal evaluates OTDR optical continuity against USGS submarine earthquake coordinates.
        Multi-Perspective Forensic Magistrate Consensus.
        """
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_ALERT_SUBMITTED, STATUS_UNRESOLVED):
            raise ContractError("Policy is not awaiting outage adjudication.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.cable_operator)
            and sender_str != _addr_str(p.client)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only operator, client, or owner can trigger adjudication.")

        feed_url = p.telemetry_feed_url
        cable_id = p.cable_system_id
        sla_latency = int(p.max_tolerable_latency_ms)

        def leader_fn():
            raw_feed = ""
            try:
                raw_feed = gl.nondet.web.render(feed_url, mode="text")
            except Exception:
                pass

            if not raw_feed:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_FETCH_FAILED",
                    "confidence": 0,
                    "cable_system_id": "",
                    "measured_latency_ms": 0,
                    "detected_magnitude_richter": 0,
                    "reason": "Subsea telemetry endpoint unreachable or empty.",
                    "evidence_hash": "0000000000000000000000000000000000000000000000000000000000000000",
                }

            ev_hash = hashlib.sha256(raw_feed.encode("utf-8")).hexdigest()

            prompt = f"""You are the Chief Submarine Telecom & Hydrographic Geohazards Magistrate on GenLayer.
Perform a multi-perspective forensic examination of live OTDR optical reflectometry, traceroute RTT, and USGS seafloor seismic data for subsea cable: {cable_id}.
CONTRACTUAL SLA LATENCY GUARANTEE: <= {sla_latency} ms RTT

MULTI-PERSPECTIVE FORENSIC MANDATE:
1. [Optoelectronics & Physical Layer Perspective]:
   - Inspect optical backscatter attenuation, optical power levels, and Round-Trip Time (RTT).
   - If optical fiber is severed (>5000ms RTT or total optical cut), record fiber severance.
2. [Hydrographic & Tectonic Geohazards Perspective]:
   - Correlate coordinates with USGS/NOAA submarine earthquake and seismic buoy datasets.
   - Extract detected seismic magnitude (x10 on Richter scale, e.g. 5.8 Richter = 58; 0 if no tectonic event).
   - If magnitude >= 5.5 Richter (55) along or near the cable corridor, this constitutes a Seabed Rupture / Turbidity Current Force Majeure event.
3. [SLA Legal Magistrate Mandate]:
   - Force Majeure Earthquake: Epicenter near cable corridor AND Seismic Magnitude >= 5.5 Richter (55):
     Output "FORCE_MAJEURE_EARTHQUAKE_VERIFIED" (SLA breach excused due to natural catastrophe).
   - Confirmed SLA Breach: Measured latency >= {sla_latency} * 2 ms OR complete optical fiber cut (>5000 ms) with NO earthquake >= 5.5 Richter:
     Output "OUTAGE_SLA_BREACH_COMPENSATED" (100% indemnity released to client).
   - Moderate Latency Degradation: Measured latency between ({sla_latency} + 1) and ({sla_latency} * 2 - 1) ms:
     Output "PARTIAL_LATENCY_DEGRADATION" (40% compensation released, 60% preserved).
   - Link Compliant: Latency <= {sla_latency} ms:
     Output "FORCE_MAJEURE_EARTHQUAKE_VERIFIED" with compliant rationale.

TELEMETRY & SEISMIC OBSERVATION PAYLOAD:
<telemetry_payload>
{raw_feed[:4000]}
</telemetry_payload>

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON without markdown fences:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "OUTAGE_SLA_BREACH_COMPENSATED" | "PARTIAL_LATENCY_DEGRADATION" | "FORCE_MAJEURE_EARTHQUAKE_VERIFIED",
  "confidence": <0-100>,
  "cable_system_id": "<exact cable id string>",
  "measured_latency_ms": <integer>,
  "detected_magnitude_richter": <integer x10>,
  "reason": "<rigorous hydrographic and optical audit justification under 200 chars>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                try:
                    parsed = json.loads(raw_res.replace("```json", "").replace("```", "").strip())
                except Exception:
                    pass

            if not parsed or not isinstance(parsed, dict):
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_PARSE_FAILED",
                    "confidence": 0,
                    "cable_system_id": "",
                    "measured_latency_ms": 0,
                    "detected_magnitude_richter": 0,
                    "reason": "AI validator parsing failed or malformed JSON returned.",
                    "evidence_hash": ev_hash,
                }

            if str(parsed.get("canary", "")) != CANARY_TOKEN:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_CANARY_FAILED",
                    "confidence": 0,
                    "cable_system_id": "",
                    "measured_latency_ms": 0,
                    "detected_magnitude_richter": 0,
                    "reason": "Security canary mismatch detected in jury output.",
                    "evidence_hash": ev_hash,
                }

            v_raw = str(parsed.get("verdict", "")).upper().strip()
            if v_raw not in {"OUTAGE_SLA_BREACH_COMPENSATED", "PARTIAL_LATENCY_DEGRADATION", "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"}:
                v_raw = "UNRESOLVED_PARSE_FAILED"

            return {
                "canary": CANARY_TOKEN,
                "verdict": v_raw,
                "confidence": max(0, min(100, int(parsed.get("confidence", 85)))),
                "cable_system_id": str(parsed.get("cable_system_id", "")).strip().upper(),
                "measured_latency_ms": max(0, min(10000, int(parsed.get("measured_latency_ms", 0)))),
                "detected_magnitude_richter": max(0, min(100, int(parsed.get("detected_magnitude_richter", 0)))),
                "reason": str(parsed.get("reason", "Subsea telemetry analysis concluded."))[:200],
                "evidence_hash": ev_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            if leader.get("canary") != CANARY_TOKEN:
                return False

            mine = leader_fn()
            if mine.get("canary") != CANARY_TOKEN:
                return False

            # Independent validation of evidence hash agreement
            if str(mine.get("evidence_hash", "")) != str(leader.get("evidence_hash", "")):
                return False

            # Independent validation of cable system ID
            if str(mine.get("cable_system_id", "")).strip() != str(leader.get("cable_system_id", "")).strip():
                return False

            # Independent tolerance on measured latency (within 20ms)
            lat_diff = abs(int(mine.get("measured_latency_ms", 0)) - int(leader.get("measured_latency_ms", 0)))
            if lat_diff > 20:
                return False

            return mine["verdict"] == leader["verdict"]

        adjudication_res = gl.vm.run_nondet(leader_fn, validator_fn)
        v_res = str(adjudication_res["verdict"])

        if v_res.startswith("UNRESOLVED_"):
            p.status = STATUS_UNRESOLVED
            p.verdict = v_res
            p.reason = str(adjudication_res["reason"])
            p.evidence_hash = str(adjudication_res.get("evidence_hash", ""))
            return

        ev_hash = str(adjudication_res.get("evidence_hash", ""))
        cable_extracted = str(adjudication_res.get("cable_system_id", "")).strip().upper()
        measured_lat = int(adjudication_res.get("measured_latency_ms", 0))
        measured_quake = int(adjudication_res.get("detected_magnitude_richter", 0))

        p.evidence_hash = ev_hash
        p.measured_latency_ms = u32(max(0, min(10000, measured_lat)))
        p.detected_magnitude_richter = u8(max(0, min(100, measured_quake)))
        p.confidence = u8(max(0, min(100, int(adjudication_res.get("confidence", 85)))))

        # On-Chain Independent Verification of Provenance & Decisive Thresholds
        if cable_extracted and cable_extracted != p.cable_system_id:
            p.verdict = "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
            p.reason = f"Provenance Mismatch: Telemetry issued for '{cable_extracted}', but policy requires '{p.cable_system_id}'."
        elif measured_quake >= 55:
            p.verdict = "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
            p.reason = f"Force Majeure Excused: Seafloor tectonic event detected ({measured_quake / 10.0} Richter). SLA penalty waived."
        elif measured_lat >= int(p.max_tolerable_latency_ms) * 2 or measured_lat >= 5000:
            p.verdict = "OUTAGE_SLA_BREACH_COMPENSATED"
            p.reason = f"SLA Breach Confirmed: Measured latency {measured_lat} ms severely breached threshold ({p.max_tolerable_latency_ms} ms) without natural geohazard."
        elif measured_lat > int(p.max_tolerable_latency_ms):
            p.verdict = "PARTIAL_LATENCY_DEGRADATION"
            p.reason = f"Moderate Latency Degradation: Measured latency {measured_lat} ms exceeds agreed SLA ({p.max_tolerable_latency_ms} ms). 40% penalty applied."
        else:
            p.verdict = "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
            p.reason = f"SLA Compliant: Measured optical latency {measured_lat} ms is within agreed tolerance ({p.max_tolerable_latency_ms} ms)."

        p.original_verdict = p.verdict
        p.audit_completed_time = self._get_current_timestamp()
        p.status = STATUS_AWAITING_PAYOUT

    @gl.public.write.payable
    def appeal_verdict(
        self,
        policy_id: str,
        dispute_reason: str,
        supplemental_audit_url: str
    ) -> None:
        """Operator or Client can appeal within 24 blocks (~72s) with a 10% staked bond."""
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT:
            raise ContractError("Can only appeal policies in AWAITING_PAYOUT status.")

        sender = _get_sender()
        if _addr_str(sender) != _addr_str(p.cable_operator) and _addr_str(sender) != _addr_str(p.client):
            raise ContractError("Role Violation: Only operator or client can file an appeal.")

        current_time = self._get_current_timestamp()
        if current_time > (p.audit_completed_time + COOLING_OFF_SECONDS):
            raise ContractError(f"Dispute cooling-off window ({int(COOLING_OFF_SECONDS)}s) has expired.")

        clean_url = str(supplemental_audit_url).strip()
        if not _is_accredited_subsea_source(clean_url):
            raise ContractError("Supplemental telemetry unauthenticated: Must originate from an accredited subsea/seismic authority.")

        required_bond = (p.escrow_amount * bigint(10)) // bigint(100)
        if required_bond == bigint(0):
            required_bond = bigint(1)

        staked = bigint(gl.message.value)
        if staked < required_bond:
            raise ContractError(f"Must stake at least 10% dispute bond ({int(required_bond)} wei).")

        clean_reason = str(dispute_reason).strip()
        if len(clean_reason) < 10:
            raise ContractError("Detailed dispute justification (>= 10 chars) required.")

        p.appeal_prior_verdict = p.verdict
        p.status = STATUS_DISPUTED
        p.dispute_initiator = _to_address(sender)
        p.dispute_bond = staked
        p.dispute_filed_time = current_time
        p.supplemental_evidence_url = clean_url
        p.reason = f"[DISPUTE by {_addr_str(sender)[:8]}]: {clean_reason} | Prior: {p.reason}"
        self.total_telecom_locked = self.total_telecom_locked + staked

    @gl.public.write
    def adjudicate_appeal(self, policy_id: str, new_evidence_url: str = "") -> None:
        """
        Supreme Subsea Appellate Tribunal evaluates strictly against bound supplemental telemetry.
        Supports retry with updated evidence URL if previous fetch/parse failed.
        """
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_DISPUTED, STATUS_UNRESOLVED):
            raise ContractError("Policy is not in DISPUTED or UNRESOLVED status awaiting appeal adjudication.")

        if p.status == STATUS_UNRESOLVED and not str(p.verdict).startswith("APPEAL_UNRESOLVED_"):
            raise ContractError("Policy is unresolved from outage alert, not an appeal.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.cable_operator)
            and sender_str != _addr_str(p.client)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only operator, client, or owner can adjudicate appeal.")

        clean_new_url = str(new_evidence_url).strip()
        if clean_new_url:
            if not _is_accredited_subsea_source(clean_new_url):
                raise ContractError("Updated supplemental telemetry unauthenticated: Must originate from an accredited subsea/seismic authority.")
            if sender_str != _addr_str(p.dispute_initiator) and sender_str != _addr_str(self.owner):
                raise ContractError("Permission Denied: Only the appellant or owner can update supplemental telemetry URL.")
            p.supplemental_evidence_url = clean_new_url

        bound_url = p.supplemental_evidence_url
        if not bound_url:
            raise ContractError("No supplemental evidence URL bound for appeal evaluation.")
        appellant = p.dispute_initiator
        prior_verdict = p.appeal_prior_verdict
        is_operator_appellant = (_addr_str(appellant) == _addr_str(p.cable_operator))

        def leader_fn():
            raw_supp = ""
            try:
                raw_supp = gl.nondet.web.render(bound_url, mode="text")
            except Exception:
                pass

            if not raw_supp:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "APPEAL_UNRESOLVED_FETCH_FAILED",
                    "measured_latency_ms": 0,
                    "detected_magnitude_richter": 0,
                    "reason": "Supplemental subsea telemetry unreachable.",
                    "evidence_hash": "0000000000000000000000000000000000000000000000000000000000000000",
                }

            ev_hash = hashlib.sha256(raw_supp.encode("utf-8")).hexdigest()

            prompt = f"""You are the Supreme Subsea Telecom Appellate Justice on GenLayer.
Evaluate bound hydrographic reflectometry and seismic telemetry for cable {p.cable_system_id}:
PRIOR VERDICT: {prior_verdict}
APPELLANT: {'OPERATOR' if is_operator_appellant else 'CLIENT'}
AGREED SLA LATENCY: {p.max_tolerable_latency_ms} ms

SUPPLEMENTAL AUDIT DATA:
{raw_supp[:4000]}

DECISION CRITERIA:
- If supplemental logs verify major earthquake (>= 5.5 Richter): Output "APPEAL_UPHELD_FORCE_MAJEURE".
- If logs conclusively verify human/trawler induced fiber cut or major SLA breach: Output "APPEAL_UPHELD_SLA_BREACH".
- If partial degradation confirmed: Output "APPEAL_UPHELD_PARTIAL".
- Otherwise: Output "APPEAL_DISMISSED".

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "APPEAL_UPHELD_FORCE_MAJEURE"|"APPEAL_UPHELD_SLA_BREACH"|"APPEAL_UPHELD_PARTIAL"|"APPEAL_DISMISSED",
  "measured_latency_ms": <integer>,
  "detected_magnitude_richter": <integer x10>,
  "reason": "<rationale under 200 chars>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                try:
                    parsed = json.loads(raw_res.replace("```json", "").replace("```", "").strip())
                except Exception:
                    pass

            if not parsed or not isinstance(parsed, dict) or str(parsed.get("canary", "")) != CANARY_TOKEN:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "APPEAL_UNRESOLVED_PARSE_FAILED",
                    "measured_latency_ms": 0,
                    "detected_magnitude_richter": 0,
                    "reason": "Appellate parsing failure.",
                    "evidence_hash": ev_hash
                }

            v_str = str(parsed.get("verdict", "")).upper().strip()
            if v_str not in {"APPEAL_UPHELD_FORCE_MAJEURE", "APPEAL_UPHELD_SLA_BREACH", "APPEAL_UPHELD_PARTIAL", "APPEAL_DISMISSED"}:
                v_str = "APPEAL_UNRESOLVED_PARSE_FAILED"

            return {
                "canary": CANARY_TOKEN,
                "verdict": v_str,
                "measured_latency_ms": max(0, min(10000, int(parsed.get("measured_latency_ms", 0)))),
                "detected_magnitude_richter": max(0, min(100, int(parsed.get("detected_magnitude_richter", 0)))),
                "reason": str(parsed.get("reason", "Appellate review completed."))[:200],
                "evidence_hash": ev_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            if leader.get("canary") != CANARY_TOKEN:
                return False

            mine = leader_fn()
            if mine.get("canary") != CANARY_TOKEN:
                return False

            if str(mine.get("evidence_hash", "")) != str(leader.get("evidence_hash", "")):
                return False

            lat_diff = abs(int(mine.get("measured_latency_ms", 0)) - int(leader.get("measured_latency_ms", 0)))
            if lat_diff > 20:
                return False

            return mine["verdict"] == leader["verdict"]

        appeal_res = gl.vm.run_nondet(leader_fn, validator_fn)
        app_verdict = appeal_res["verdict"]
        app_reason = appeal_res["reason"]

        if app_verdict.startswith("APPEAL_UNRESOLVED_"):
            p.status = STATUS_UNRESOLVED
            p.verdict = app_verdict
            p.reason = f"[APPEAL UNRESOLVED] {app_reason}"
            return

        escrow_val = p.escrow_amount
        bond_val = p.dispute_bond
        total_settling = escrow_val + bond_val
        p.dispute_bond = bigint(0)
        p.escrow_amount = bigint(0)  # Double-payout protection

        self.total_telecom_locked = self.total_telecom_locked - total_settling
        self.total_policies_settled = self.total_policies_settled + u32(1)

        counterparty = p.client if is_operator_appellant else p.cable_operator

        if app_verdict == "APPEAL_UPHELD_FORCE_MAJEURE":
            p.status = STATUS_SETTLED_FORCE_MAJEURE
            p.verdict = "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
            p.reason = f"[APPEAL UPHELD] {app_reason}"
            self._credit_payout(p.cable_operator, escrow_val)
            if is_operator_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        elif app_verdict == "APPEAL_UPHELD_SLA_BREACH":
            p.status = STATUS_SETTLED_SLA_BREACH
            p.verdict = "OUTAGE_SLA_BREACH_COMPENSATED"
            p.reason = f"[APPEAL UPHELD] {app_reason}"
            self._credit_payout(p.client, escrow_val)
            if not is_operator_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        elif app_verdict == "APPEAL_UPHELD_PARTIAL":
            p.status = STATUS_SETTLED_PARTIAL
            p.verdict = "PARTIAL_LATENCY_DEGRADATION"
            payout = (escrow_val * bigint(40)) // bigint(100)
            refund = escrow_val - payout
            p.reason = f"[APPEAL RESOLUTION] {app_reason}"
            self._credit_payout(p.client, payout)
            self._credit_payout(p.cable_operator, refund)
            self._credit_payout(appellant, bond_val)

        else:
            p.reason = f"[APPEAL DISMISSED] {app_reason}"
            self._credit_payout(counterparty, bond_val)

            if p.original_verdict == "OUTAGE_SLA_BREACH_COMPENSATED":
                p.status = STATUS_SETTLED_SLA_BREACH
                p.verdict = "OUTAGE_SLA_BREACH_COMPENSATED"
                self._credit_payout(p.client, escrow_val)
            elif p.original_verdict == "PARTIAL_LATENCY_DEGRADATION":
                p.status = STATUS_SETTLED_PARTIAL
                p.verdict = "PARTIAL_LATENCY_DEGRADATION"
                payout = (escrow_val * bigint(40)) // bigint(100)
                refund = escrow_val - payout
                self._credit_payout(p.client, payout)
                self._credit_payout(p.cable_operator, refund)
            else:
                p.status = STATUS_SETTLED_FORCE_MAJEURE
                p.verdict = "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
                self._credit_payout(p.cable_operator, escrow_val)

    @gl.public.write
    def refund_dispute_bond(self, policy_id: str) -> None:
        """
        Allows appellant to immediately reclaim 100% of their dispute bond if appeal evaluation
        encountered an unresolved fetch or parse failure, without stranding funds.
        Restores policy status back to STATUS_AWAITING_PAYOUT and pre-appeal verdict.
        """
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_UNRESOLVED or not str(p.verdict).startswith("APPEAL_UNRESOLVED_"):
            raise ContractError("Dispute bond refund is only available when appeal adjudication encountered an unresolved fetch/parse failure.")

        sender_str = _addr_str(_get_sender())
        if sender_str != _addr_str(p.dispute_initiator) and sender_str != _addr_str(self.owner):
            raise ContractError("Permission Denied: Only appellant or contract owner can trigger dispute bond refund.")

        bond_val = p.dispute_bond
        if bond_val <= bigint(0):
            raise ContractError("No active dispute bond to refund.")

        # Exactly update accounting: clear bond and decrement total_telecom_locked
        p.dispute_bond = bigint(0)
        self.total_telecom_locked = self.total_telecom_locked - bond_val if self.total_telecom_locked >= bond_val else bigint(0)

        # Restore policy state and prior verdict
        p.status = STATUS_AWAITING_PAYOUT
        p.verdict = p.appeal_prior_verdict if p.appeal_prior_verdict and p.appeal_prior_verdict != "PENDING" else p.original_verdict
        p.audit_completed_time = self._get_current_timestamp()
        p.reason = f"[APPEAL BOND REFUNDED]: Adjudication unresolvable ({p.verdict}). 100% dispute bond ({int(bond_val)} wei) refunded to appellant. Policy restored to '{p.verdict}'."

        # Credit payout to appellant via pull-payment
        self._credit_payout(p.dispute_initiator, bond_val)

    @gl.public.write
    def resolve_stale_appeal(self, policy_id: str) -> None:
        """
        Role: Bounded recovery for unresolved or timed-out subsea appeals.
        Safeguards both the SLA escrow and dispute bond:
        1. Refunds 100% of the dispute bond back to the appellant.
        2. Restores policy to pre-appeal verdict and resets cooling-off window.
        """
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_DISPUTED, STATUS_UNRESOLVED):
            raise ContractError("Policy is not in a disputed or unresolved appellate state.")

        if p.dispute_bond <= bigint(0):
            raise ContractError("No active dispute bond locked on this policy.")

        current_time = self._get_current_timestamp()
        timeout_threshold = p.dispute_filed_time + APPEAL_TIMEOUT_SECONDS
        is_timed_out = (current_time > timeout_threshold)
        is_unresolvable_error = (p.status == STATUS_UNRESOLVED and str(p.verdict).startswith("APPEAL_UNRESOLVED_"))

        if not is_timed_out and not is_unresolvable_error:
            rem = int(timeout_threshold - current_time)
            raise ContractError(f"Appellate window is active. Timeout recovery available in {max(0, rem)} seconds.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.cable_operator)
            and sender_str != _addr_str(p.client)
            and sender_str != _addr_str(p.dispute_initiator)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only policy participants, appellant, or owner can trigger appeal recovery.")

        bond_val = p.dispute_bond
        p.dispute_bond = bigint(0)
        self.total_telecom_locked = self.total_telecom_locked - bond_val if self.total_telecom_locked >= bond_val else bigint(0)

        # 1. Safely refund 100% of dispute bond to appellant
        self._credit_payout(p.dispute_initiator, bond_val)

        # 2. Restore policy to prior pre-appeal verdict
        p.verdict = p.appeal_prior_verdict if p.appeal_prior_verdict and p.appeal_prior_verdict != "PENDING" else "FORCE_MAJEURE_EARTHQUAKE_VERIFIED"
        p.status = STATUS_AWAITING_PAYOUT
        p.audit_completed_time = current_time
        p.reason = f"[APPEAL TIMEOUT RECOVERY]: Supplemental telemetry timed out or unreachable. 100% dispute bond ({bond_val} wei) refunded to appellant. Policy restored to prior verdict '{p.verdict}'."

    @gl.public.write
    def finalize_settlement(self, policy_id: str) -> None:
        """Role: Stakeholders or owner executes uncontested settlement strictly after cooling-off window."""
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT:
            raise ContractError("Policy is not in STATUS_AWAITING_PAYOUT state.")

        current_time = self._get_current_timestamp()
        if current_time <= (p.audit_completed_time + COOLING_OFF_SECONDS):
            remaining = (p.audit_completed_time + COOLING_OFF_SECONDS) - current_time
            raise ContractError(f"Cooling-off challenge window ({int(COOLING_OFF_SECONDS)}s) is active. Payout locked for another {remaining}s.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.cable_operator)
            and sender_str != _addr_str(p.client)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only stakeholders or owner can finalize payout.")

        escrow_val = p.escrow_amount
        p.escrow_amount = bigint(0)  # Double-payout protection
        self.total_telecom_locked = self.total_telecom_locked - escrow_val
        self.total_policies_settled = self.total_policies_settled + u32(1)

        if p.verdict == "OUTAGE_SLA_BREACH_COMPENSATED":
            p.status = STATUS_SETTLED_SLA_BREACH
            self._credit_payout(p.client, escrow_val)

        elif p.verdict == "PARTIAL_LATENCY_DEGRADATION":
            p.status = STATUS_SETTLED_PARTIAL
            payout = (escrow_val * bigint(40)) // bigint(100)
            refund = escrow_val - payout
            self._credit_payout(p.client, payout)
            self._credit_payout(p.cable_operator, refund)

        else:
            p.status = STATUS_SETTLED_FORCE_MAJEURE
            self._credit_payout(p.cable_operator, escrow_val)

    @gl.public.write
    def cancel_or_reclaim(self, policy_id: str) -> None:
        """Role: Only cable operator can reclaim escrow if coverage expired without alerts or stalled."""
        self._ensure_owner()
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if _addr_str(_get_sender()) != _addr_str(p.cable_operator) and _addr_str(_get_sender()) != _addr_str(self.owner):
            raise ContractError("Role Violation: Only cable operator or owner can reclaim expired SLA escrow.")

        current_time = self._get_current_timestamp()
        if p.status in (STATUS_POLICY_OPEN, STATUS_UNRESOLVED):
            if current_time < p.expires_at_time:
                raise ContractError(f"Cannot reclaim: Policy is still active (expires at {int(p.expires_at_time)}).")
        else:
            raise ContractError("Cannot reclaim: Policy has telemetry actively undergoing evaluation or already settled.")

        p.status = STATUS_EXPIRED_RECLAIMED
        p.verdict = "EXPIRED_CLEAN"
        p.reason = "Policy duration completed without active subsea outage triggers. Escrow reclaimed by cable operator."

        escrow_val = p.escrow_amount
        p.escrow_amount = bigint(0)
        self.total_telecom_locked = self.total_telecom_locked - escrow_val
        self._credit_payout(p.cable_operator, escrow_val)

    @gl.public.write
    def claim_payout(self) -> None:
        """
        Pull-Payment claim: Safely withdraw accrued beneficiary credits with verified delivery accounting.
        Never extinguishes beneficiary balances upon outbound transfer failures.
        """
        self._ensure_owner()
        sender = _get_sender()
        s_str = _addr_str(sender)
        bal = self.claimable_balances.get(s_str, bigint(0))
        if bal <= bigint(0):
            raise ContractError("No claimable balance available for withdrawal.")

        try:
            gl.get_contract_at(sender).emit_transfer(value=u256(int(bal)))
        except Exception as e:
            raise ContractError(f"Outbound transfer failed during claim: {str(e)}. Balance preserved.")

        # Successfully delivered: clear claimable and credit withdrawn ledger
        self.claimable_balances[s_str] = bigint(0)
        self.total_pending_claims = self.total_pending_claims - bal if self.total_pending_claims >= bal else bigint(0)
        prev_w = self.total_withdrawn_ledger.get(s_str, bigint(0))
        self.total_withdrawn_ledger[s_str] = prev_w + bal

    # ── Read-only Views ───────────────────────────────────────────────

    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        data = {
            "policy_id": p.policy_id,
            "cable_operator": _addr_str(p.cable_operator),
            "client": _addr_str(p.client),
            "dispute_initiator": _addr_str(p.dispute_initiator),
            "escrow_amount": str(p.escrow_amount),
            "dispute_bond": str(p.dispute_bond),
            "cable_system_id": p.cable_system_id,
            "max_tolerable_latency_ms": int(p.max_tolerable_latency_ms),
            "telemetry_feed_url": p.telemetry_feed_url,
            "evidence_hash": p.evidence_hash,
            "status": int(p.status),
            "verdict": p.verdict,
            "original_verdict": p.original_verdict,
            "reason": p.reason,
            "confidence": int(p.confidence),
            "measured_latency_ms": int(p.measured_latency_ms),
            "detected_magnitude_richter": int(p.detected_magnitude_richter),
            "created_at_time": str(p.created_at_time),
            "expires_at_time": str(p.expires_at_time),
            "audit_completed_time": str(p.audit_completed_time),
            "supplemental_evidence_url": p.supplemental_evidence_url,
            "appeal_prior_verdict": p.appeal_prior_verdict,
            "dispute_filed_time": str(p.dispute_filed_time),
        }
        return json.dumps(data)

    @gl.public.view
    def get_user_role(self, policy_id: str, account: Address) -> str:
        pid = self._resolve_pid(policy_id)
        acc_str = _addr_str(account)
        if pid not in self.policies:
            if acc_str == _addr_str(self.owner):
                return "OWNER"
            return "OBSERVER"

        p = self.policies[pid]
        if acc_str == _addr_str(p.cable_operator):
            return "OPERATOR"
        if acc_str == _addr_str(p.client):
            return "CLIENT"
        if p.status in (STATUS_DISPUTED, STATUS_UNRESOLVED) and acc_str == _addr_str(p.dispute_initiator):
            return "APPELLANT"
        if acc_str == _addr_str(self.owner):
            return "OWNER"
        return "OBSERVER"

    @gl.public.view
    def get_remaining_cooling_off_seconds(self, policy_id: str) -> u64:
        """Returns remaining cooling off challenge window in seconds (0 if expired or not in cooling off)."""
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            return u64(0)
        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT or p.audit_completed_time <= bigint(0):
            return u64(0)
        current_time = self._get_current_timestamp()
        expiry = p.audit_completed_time + COOLING_OFF_SECONDS
        remaining = int(expiry - current_time)
        return u64(remaining if remaining > 0 else 0)

    @gl.public.view
    def get_policy_count(self) -> u64:
        return u64(len(self.policy_ids))

    @gl.public.view
    def get_all_policies(self) -> str:
        policies_list = []
        for pid in self.policy_ids:
            if pid in self.policies:
                p = self.policies[pid]
                policies_list.append({
                    "policy_id": p.policy_id,
                    "cable_operator": _addr_str(p.cable_operator),
                    "client": _addr_str(p.client),
                    "dispute_initiator": _addr_str(p.dispute_initiator),
                    "escrow_amount": str(p.escrow_amount),
                    "dispute_bond": str(p.dispute_bond),
                    "cable_system_id": p.cable_system_id,
                    "max_tolerable_latency_ms": int(p.max_tolerable_latency_ms),
                    "telemetry_feed_url": p.telemetry_feed_url,
                    "evidence_hash": p.evidence_hash,
                    "status": int(p.status),
                    "verdict": p.verdict,
                    "original_verdict": p.original_verdict,
                    "reason": p.reason,
                    "confidence": int(p.confidence),
                    "measured_latency_ms": int(p.measured_latency_ms),
                    "detected_magnitude_richter": int(p.detected_magnitude_richter),
                    "created_at_time": str(p.created_at_time),
                    "expires_at_time": str(p.expires_at_time),
                    "audit_completed_time": str(p.audit_completed_time),
                    "supplemental_evidence_url": p.supplemental_evidence_url,
                    "appeal_prior_verdict": p.appeal_prior_verdict,
                    "dispute_filed_time": str(p.dispute_filed_time),
                })
        return json.dumps(policies_list)

    @gl.public.view
    def get_claimable_balance(self, account: Address) -> str:
        return str(self.claimable_balances.get(_addr_str(account), bigint(0)))

    @gl.public.view
    def get_total_withdrawn(self, account: Address) -> str:
        return str(self.total_withdrawn_ledger.get(_addr_str(account), bigint(0)))

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_policies": len(self.policy_ids),
            "total_telecom_locked": str(self.total_telecom_locked),
            "total_policies_settled": int(self.total_policies_settled),
            "total_pending_claims": str(self.total_pending_claims),
            "owner": _addr_str(self.owner),
        }
        return json.dumps(data)
