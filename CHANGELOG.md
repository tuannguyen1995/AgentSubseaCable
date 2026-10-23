# Changelog — AgentSubseaCable Protocol

All notable changes to the **AgentSubseaCable** autonomous protocol and decentralized application are documented in this file.

---

## [1.0.0] - 2026-10-23 (Milestone Release)

### Core Intelligent Contract (`contracts/contract.py`)
- **Py-GenLayer Consensus Implementation:** Native GenLayer Intelligent Contract utilizing `gl.nondet.web.render` and `gl.vm.run_nondet` multi-validator consensus.
- **Parametric Geohazard Logic:**
  - Automated distinction between human/trawler fiber severance (`OUTAGE_SLA_BREACH_COMPENSATED`) and subsea earthquakes $\ge 5.5\text{ Richter}$ (`FORCE_MAJEURE_EARTHQUAKE_VERIFIED`).
  - Moderate latency degradation penalty tiers ($\ge 30\%$ RTT spike $\rightarrow$ 40% payout).
- **Accredited Source Enforcement:** Whitelisted hydrographic, seismic, and internet telemetry authorities (`ACCREDITED_SUBSEA_SOURCES`: Submarine Cable Map, USGS, NOAA NDBC, RIPE Atlas, EMSC).
- **Security Canary Defense:** Injection-proof canary verification with `CANARY_AGENT_SUBSEA_CABLE_V1`.
- **Pure Pull-Payment Accounting:** Secure `_credit_payout` and `claim_payout` ledger preventing reentrancy and token-locking anomalies.
- **Appellate Dispute & Stale Recovery:** 24-block (~72s) cooling-off challenge requiring 10% staked bond with 7-day bounded recovery refunding 100% of bond on stale deadlock.
- **Consensus Datetime:** Time strictly anchored to `gl.message_raw["datetime"]`.

### Testing Suite (`tests/`)
- `tests/conftest.py`: Authentic execution harness supporting native `gltest` and deterministic multi-validator mocks.
- `tests/test_agentsubseacable.py`: Full lifecycle tests covering fiber cut compensation, earthquake Force Majeure waiver, partial latency penalties, appeal disputes, and unaccredited domain rejection.
- `tests/test_agentsubseacable_runtime.py`: Runtime verification of `STATUS_UNRESOLVED` state preservation, clean expiration reclaims, and access control.

### Operations Center Frontend (`frontend/`)
- **Subsea Global NOC Brand System:** Abyssal Marine & Fiber Optic Blue theme (`#040914`, `#0A1526`, `#06B6D4`, `#F59E0B`, `#EF4444`, `#10B981`).
- **Interactive Bathymetric Cable Map (`SubseaWorldMap.tsx`):** Vector visualization of major oceanic corridors (AAG, SEA-ME-WE-5, TAT-14, FASTER, 2Africa) with active optical pulses and seismic tremor overlays.
- **NOC Management Console (`PolicyCard.tsx`):** Real-time OTDR latency gauges, Richter seismic meters, cooling-off countdown timer, and role-based action triggers.
- **Accredited Telemetry Modals:**
  - `CreatePolicyModal.tsx`: Escrow deposit form with preset oceanic corridors.
  - `TriggerAlertModal.tsx`: 1-click test endpoints for RIPE Atlas and USGS feeds.
  - `TelemetryInspectorModal.tsx`: Evidence hash snapshot and AI tribunal breakdown.
  - `AppealModal.tsx`: 10% bond staking portal.
  - `PullPayoutButton.tsx`: Safe pull-payment withdrawal ledger.

### Deployment & Tooling (`scripts/`)
- `scripts/deploy_studionet.py`: Automated contract deployment to GenLayer StudioNet (Chain 61999). Deployed at `0xdf3A336aBc2d48728013A47046BEa22de260825F`.
- `scripts/verify_lifecycle.py`: Standalone protocol lifecycle simulation script.
- `scripts/generate_logo.py`: High-resolution NOC branding generator.
