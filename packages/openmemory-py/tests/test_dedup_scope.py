from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1] / "src" / "openmemory"


def _ensure_pkg(name: str) -> types.ModuleType:
    mod = sys.modules.get(name)
    if mod is None:
        mod = types.ModuleType(name)
        mod.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = mod
    return mod


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def _make_stubs() -> dict:
    def _stub(name: str, **attrs: object) -> types.ModuleType:
        mod = types.ModuleType(name)
        for k, v in attrs.items():
            setattr(mod, k, v)
        return mod

    return {
        "numpy": types.ModuleType("numpy"),
        "openmemory.core.db": _stub("openmemory.core.db", q=None, db=None, transaction=lambda: None),
        "openmemory.core.config": _stub("openmemory.core.config", env=types.SimpleNamespace()),
        "openmemory.core.constants": _stub("openmemory.core.constants", SECTOR_CONFIGS={}),
        "openmemory.core.vector_store": _stub("openmemory.core.vector_store", vector_store=None),
        "openmemory.utils.chunking": _stub("openmemory.utils.chunking", chunk_text=lambda *a, **kw: []),
        "openmemory.utils.keyword": _stub(
            "openmemory.utils.keyword",
            keyword_filter_memories=lambda *a, **kw: [],
            compute_keyword_overlap=lambda *a, **kw: 0.0,
        ),
        "openmemory.utils.vectors": _stub(
            "openmemory.utils.vectors",
            buf_to_vec=lambda *a, **kw: [],
            vec_to_buf=lambda *a, **kw: b"",
            cos_sim=lambda *a, **kw: 0.0,
        ),
        "openmemory.memory.embed": _stub(
            "openmemory.memory.embed",
            embed_multi_sector=lambda *a, **kw: {},
            embed_for_sector=lambda *a, **kw: [],
            calc_mean_vec=lambda *a, **kw: [],
        ),
        "openmemory.memory.decay": _stub(
            "openmemory.memory.decay",
            inc_q=lambda *a, **kw: None,
            dec_q=lambda *a, **kw: None,
            on_query_hit=lambda *a, **kw: None,
            calc_recency_score=lambda *a, **kw: 0.0,
            pick_tier=lambda *a, **kw: "cold",
        ),
        "openmemory.ops.dynamics": _stub(
            "openmemory.ops.dynamics",
            calculateCrossSectorResonanceScore=lambda *a, **kw: 0.0,
            applyRetrievalTraceReinforcementToMemory=lambda *a, **kw: None,
            propagateAssociativeReinforcementToLinkedNodes=lambda *a, **kw: None,
        ),
        "openmemory.memory.user_summary": _stub(
            "openmemory.memory.user_summary",
            update_user_summary=lambda *a, **kw: None,
        ),
    }


def _load_hsg():
    _ensure_pkg("openmemory")
    _ensure_pkg("openmemory.utils")
    _ensure_pkg("openmemory.memory")
    _ensure_pkg("openmemory.core")
    _ensure_pkg("openmemory.ops")

    with patch.dict(sys.modules, _make_stubs()):
        _load_module("openmemory.utils.text", ROOT / "utils" / "text.py")
        return _load_module("openmemory.memory.hsg", ROOT / "memory" / "hsg.py")


HSG = _load_hsg()


def test_dedup_scope_requires_same_space_and_payload_sha():
    # both fields match → dedup allowed
    assert HSG.dedup_scope_matches(
        {"space": "private:alice", "payload_sha": "sha-1"},
        {"space": "private:alice", "payload_sha": "sha-1"},
    )
    # space matches but target_space differs → no dedup
    assert not HSG.dedup_scope_matches(
        {"space": "private:alice", "target_space": "ns-A", "payload_sha": "sha-1"},
        {"space": "private:alice", "target_space": "ns-B", "payload_sha": "sha-1"},
    )
    # space differs → no dedup
    assert not HSG.dedup_scope_matches(
        {"space": "private:alice", "payload_sha": "sha-1"},
        {"space": "private:bob", "payload_sha": "sha-1"},
    )
    # payload_sha differs → no dedup
    assert not HSG.dedup_scope_matches(
        {"space": "private:alice", "payload_sha": "sha-1"},
        {"space": "private:alice", "payload_sha": "sha-2"},
    )
    # target_space differs, no space field → no dedup
    assert not HSG.dedup_scope_matches(
        {"target_space": "ns-A", "payload_sha": "sha-1"},
        {"target_space": "ns-B", "payload_sha": "sha-1"},
    )


def test_normalize_dedup_user_id_defaults_to_anonymous():
    assert HSG.normalize_dedup_user_id(None) == "anonymous"
    assert HSG.normalize_dedup_user_id("alice") == "alice"
