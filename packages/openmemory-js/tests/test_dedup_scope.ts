import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
    const temp_dir = await fs.mkdtemp(
        path.join(os.tmpdir(), "openmemory-dedup-scope-"),
    );
    process.env.OM_DB_PATH = path.join(temp_dir, "openmemory.sqlite");
    process.env.OM_METADATA_BACKEND = "sqlite";
    process.env.OM_EMBEDDINGS = "synthetic";
    process.env.OM_USE_SUMMARY_ONLY = "false";

    const [{ Memory }, { q }] = await Promise.all([
        import("../src/core/memory"),
        import("../src/core/db"),
    ]);

    await q.clear_all.run();

    const memory = new Memory();
    const content = "Shared memory content for dedup scope validation.";

    const private_alice = await memory.add(content, {
        user_id: "alice",
        space: "private:alice",
        target_space: "private:alice",
        payload_sha: "sha-alice-1",
    });
    const private_bob = await memory.add(content, {
        user_id: "bob",
        space: "private:bob",
        target_space: "private:bob",
        payload_sha: "sha-alice-1",
    });
    assert.notEqual(
        private_bob.id,
        private_alice.id,
        "different users must not reuse the same memory_id",
    );

    const team_alice = await memory.add(content, {
        user_id: "alice",
        space: "team:red",
        target_space: "team:red",
        payload_sha: "sha-alice-1",
    });
    assert.notEqual(
        team_alice.id,
        private_alice.id,
        "same user with a different space must create a new memory",
    );

    // space differs but target_space same → space is checked independently
    const diff_space_same_target = await memory.add(content, {
        user_id: "alice",
        space: "team:blue",
        target_space: "private:alice",
        payload_sha: "sha-alice-1",
    });
    assert.notEqual(
        diff_space_same_target.id,
        private_alice.id,
        "different space with same target_space must create a new memory",
    );

    const payload_variant = await memory.add(content, {
        user_id: "alice",
        space: "private:alice",
        target_space: "private:alice",
        payload_sha: "sha-alice-2",
    });
    assert.notEqual(
        payload_variant.id,
        private_alice.id,
        "same user and space with a different payload_sha must create a new memory",
    );

    const exact_duplicate = await memory.add(content, {
        user_id: "alice",
        space: "private:alice",
        target_space: "private:alice",
        payload_sha: "sha-alice-1",
    });
    assert.equal(
        exact_duplicate.id,
        private_alice.id,
        "same user, space, and payload_sha should still deduplicate",
    );
    assert.equal(exact_duplicate.deduplicated, true);

    // same space but different target_space must NOT deduplicate
    const different_target = await memory.add(content, {
        user_id: "alice",
        space: "private:alice",
        target_space: "ns-B",
        payload_sha: "sha-alice-1",
    });
    assert.notEqual(
        different_target.id,
        private_alice.id,
        "same space but different target_space must create a new memory",
    );

    const alice_memories = await q.all_mem_by_user.all("alice", 20, 0);
    assert.equal(alice_memories.length, 5);

    console.log("test_dedup_scope.ts passed");
}

main().catch((error) => {
    console.error("test_dedup_scope.ts failed", error);
    process.exitCode = 1;
});
