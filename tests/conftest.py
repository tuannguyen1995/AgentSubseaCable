import sys
import types
from pathlib import Path
import json
import importlib.util
import pytest

# Ensure an authentic GenLayer runtime mock environment if not already running in GenVM
if 'genlayer' not in sys.modules:
    gl_mod = types.ModuleType('genlayer')

    class _Address:
        def __init__(self, val=""):
            if isinstance(val, int):
                self.as_hex = f"0x{val:040x}".lower()
            elif isinstance(val, _Address):
                self.as_hex = val.as_hex.lower()
            else:
                self.as_hex = str(val).lower()
            try:
                clean_hex = self.as_hex.replace("0x", "")
                self.as_bytes = bytes.fromhex(clean_hex)
            except Exception:
                self.as_bytes = b"\x00" * 20

        def __str__(self):
            return self.as_hex

        def __repr__(self):
            return self.as_hex

        def __eq__(self, other):
            return str(self).lower() == str(other).lower()

    gl_mod.Address = _Address
    gl_mod.u8 = int
    gl_mod.u32 = int
    gl_mod.u64 = int
    gl_mod.u256 = int
    gl_mod.i64 = int
    gl_mod.bigint = int
    gl_mod.TreeMap = dict
    gl_mod.DynArray = list
    gl_mod.allow_storage = lambda cls: cls

    class _PublicWrite:
        def __call__(self, fn):
            fn._is_public_write = True
            return fn

        @property
        def payable(self):
            def decorator(fn):
                fn._is_public_write = True
                fn._is_payable = True
                return fn
            return decorator

    class _PublicView:
        def __call__(self, fn):
            fn._is_public_view = True
            return fn

    class _Public:
        write = _PublicWrite()
        view = _PublicView()

    class _Message:
        def __init__(self):
            self.sender_address = _Address("0x1111111111111111111111111111111111111111")
            self.sender = self.sender_address
            self.value = 0

    class _VMReturn:
        def __init__(self, calldata):
            self.calldata = calldata

    class _VM:
        Return = _VMReturn

        def run_nondet(self, leader_fn, validator_fn):
            leader_result = leader_fn()
            ret_obj = _VMReturn(leader_result)
            is_valid = validator_fn(ret_obj)
            if not is_valid:
                raise RuntimeError("Consensus Disagreement: Validator rejected leader output.")
            return leader_result

    class _NondetWeb:
        def __init__(self, provider):
            self.provider = provider

        def render(self, url, mode="text", wait_until="networkidle", timeout=15000):
            url_str = str(url).strip()
            if hasattr(self.provider, "web_mocks") and url_str in self.provider.web_mocks:
                entry = self.provider.web_mocks[url_str]
                if isinstance(entry, dict) and "body" in entry:
                    return entry["body"]
                return str(entry)
            return ""

    class _Nondet:
        def __init__(self, provider):
            self.web = _NondetWeb(provider)
            self.provider = provider

        def exec_prompt(self, prompt, response_format=None):
            if hasattr(self.provider, "llm_mocks"):
                for pattern, response in self.provider.llm_mocks.items():
                    return response
            return "{}"

    class _TargetContract:
        def __init__(self, addr):
            self.addr = addr

        def emit_transfer(self, value=0):
            return True

    class _Contract:
        def __new__(cls, *args, **kwargs):
            instance = super().__new__(cls)
            instance.policies = {}
            instance.policy_ids = []
            instance.claimable_balances = {}
            instance.total_withdrawn_ledger = {}
            return instance

    class _GL:
        Contract = _Contract

        def __init__(self, provider=None):
            self.message = _Message()
            self.message_raw = {"datetime": "2026-10-23T08:00:00+00:00"}
            self.public = _Public()
            self.vm = _VM()
            self.provider = provider
            self.nondet = _Nondet(provider)
            self.Contract = _Contract

        def get_contract_at(self, addr):
            return _TargetContract(addr)

    gl_instance = _GL()
    gl_mod.gl = gl_instance
    gl_mod.Contract = _Contract
    sys.modules['genlayer'] = gl_mod
else:
    gl_mod = sys.modules['genlayer']
    if not hasattr(gl_mod, 'gl'):
        class _Message:
            def __init__(self):
                self.sender_address = gl_mod.Address("0x1111111111111111111111111111111111111111")
                self.sender = self.sender_address
                self.value = 0

        class _VMReturn:
            def __init__(self, calldata):
                self.calldata = calldata

        class _VM:
            Return = _VMReturn
            def run_nondet(self, leader_fn, validator_fn):
                leader_result = leader_fn()
                ret_obj = _VMReturn(leader_result)
                is_valid = validator_fn(ret_obj)
                if not is_valid:
                    raise RuntimeError("Consensus Disagreement: Validator rejected leader output.")
                return leader_result

        class _NondetWeb:
            def __init__(self, provider=None):
                self.provider = provider
            def render(self, url, mode="text", wait_until="networkidle", timeout=15000):
                url_str = str(url).strip()
                if self.provider and hasattr(self.provider, "web_mocks") and url_str in self.provider.web_mocks:
                    entry = self.provider.web_mocks[url_str]
                    if isinstance(entry, dict) and "body" in entry:
                        return entry["body"]
                    return str(entry)
                return ""

        class _Nondet:
            def __init__(self, provider=None):
                self.web = _NondetWeb(provider)
                self.provider = provider
            def exec_prompt(self, prompt, response_format=None):
                if self.provider and hasattr(self.provider, "llm_mocks"):
                    for pattern, response in self.provider.llm_mocks.items():
                        return response
                return "{}"

        class _TargetContract:
            def __init__(self, addr):
                self.addr = addr
            def emit_transfer(self, value=0):
                return True

        class _Contract:
            def __new__(cls, *args, **kwargs):
                instance = super().__new__(cls)
                instance.policies = {}
                instance.policy_ids = []
                instance.claimable_balances = {}
                instance.total_withdrawn_ledger = {}
                return instance

        class _GL:
            Contract = _Contract
            def __init__(self, provider=None):
                self.message = _Message()
                self.message_raw = {"datetime": "2026-10-23T08:00:00+00:00"}
                self.vm = _VM()
                self.provider = provider
                self.nondet = _Nondet(provider)
                self.Contract = _Contract
            def get_contract_at(self, addr):
                return _TargetContract(addr)

        gl_instance = _GL()
        gl_mod.gl = gl_instance
    else:
        gl_instance = gl_mod.gl


# ── Execution Harness Directly Importing and Executing contracts/contract.py ─

def load_contract_module():
    contract_path = Path(__file__).parent.parent / "contracts" / "contract.py"
    spec = importlib.util.spec_from_file_location("agent_subsea_cable_contract", contract_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _ConnectedMethod:
    def __init__(self, harness, account, method_name):
        self.harness = harness
        self.account = account
        self.method_name = method_name

    def __call__(self, args=None, value=0):
        args = args or []
        gl_mod.gl.message.sender_address = gl_mod.Address(self.account)
        gl_mod.gl.message.sender = gl_mod.Address(self.account)
        gl_mod.gl.message.value = int(value)
        gl_mod.gl.message_raw["datetime"] = self.harness.current_iso_time()

        method = getattr(self.harness.contract_instance, self.method_name)
        return_value = method(*args)
        return _CallResult(return_value)

    def call(self, args=None):
        args = args or []
        gl_mod.gl.message.sender_address = gl_mod.Address(self.account)
        gl_mod.gl.message.sender = gl_mod.Address(self.account)
        gl_mod.gl.message_raw["datetime"] = self.harness.current_iso_time()

        method = getattr(self.harness.contract_instance, self.method_name)
        return method(*args)


class _ConnectedContract:
    def __init__(self, harness, account):
        self.harness = harness
        self.account = account

    def __getattr__(self, name):
        return _ConnectedMethod(self.harness, self.account, name)


class _CallResult:
    def __init__(self, return_value):
        self.return_value = return_value

    def call(self):
        return self.return_value

    def __str__(self):
        return str(self.return_value)

    def __int__(self):
        return int(self.return_value)

    def __eq__(self, other):
        if isinstance(other, _CallResult):
            return self.return_value == other.return_value
        return self.return_value == other


class RealContractHarness:
    """Authentic Execution Harness running the submitted Intelligent Contract contracts/contract.py."""
    def __init__(self, client, contract_cls, *args):
        self.client = client
        self.contract_cls = contract_cls
        self.simulated_time = 1760000000

        gl_mod.gl.message.sender_address = gl_mod.Address(client.accounts[0])
        gl_mod.gl.message.sender = gl_mod.Address(client.accounts[0])
        gl_mod.gl.message_raw["datetime"] = self.current_iso_time()

        self.contract_instance = contract_cls(*args)

    def current_iso_time(self):
        from datetime import datetime, timezone
        return datetime.fromtimestamp(self.simulated_time, tz=timezone.utc).isoformat()

    def set_time(self, new_timestamp):
        self.simulated_time = int(new_timestamp)

    def connect(self, account):
        return _ConnectedContract(self, account)

    def __getattr__(self, name):
        return _ConnectedMethod(self, self.client.accounts[0], name)


class _Provider:
    def __init__(self):
        self.llm_mocks = {}
        self.web_mocks = {}

    def make_request(self, method, params):
        if method == "sim_installMocks":
            if "llm_mocks" in params:
                self.llm_mocks.update(params["llm_mocks"])
            if "web_mocks" in params:
                self.web_mocks.update(params["web_mocks"])
            return True
        return None


class _Client:
    def __init__(self):
        self.accounts = [
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
            "0x3333333333333333333333333333333333333333",
            "0x4444444444444444444444444444444444444444",
        ]
        self.provider = _Provider()
        gl_mod.gl.provider = self.provider
        gl_mod.gl.nondet.provider = self.provider
        gl_mod.gl.nondet.web.provider = self.provider

    def deploy(self, path, *args, **kwargs):
        mod = load_contract_module()
        contract_cls = getattr(mod, "Contract")
        deploy_args = kwargs.get("args", list(args))
        return RealContractHarness(self, contract_cls, *deploy_args)


@pytest.fixture
def client():
    return _Client()
