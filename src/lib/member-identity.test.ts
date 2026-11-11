import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { resolveMemberIdentity } from "./member-identity";

describe("administrator member identity edits", () => {
  const members = [{ userId: "member-1", name: "윤태상", phone: "010-4908-3307" }];
  const oldProfile = { name: "김민준", phone: "010-2001-0001" };

  test("uses the administrator's renamed member instead of the stale profile", () => {
    assert.equal(resolveMemberIdentity(members, "member-1", oldProfile).name, "윤태상");
  });

  test("uses the administrator's updated telephone number", () => {
    assert.equal(resolveMemberIdentity(members, "member-1", oldProfile).phone, "010-4908-3307");
  });

  test("does not link a different account by matching name", () => {
    assert.equal(resolveMemberIdentity(members, "another-user", { name: "윤태상", phone: "" }).member, undefined);
  });
});