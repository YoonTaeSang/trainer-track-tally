import { describe, expect, test } from "bun:test";
import { resolveMemberIdentity } from "./member-identity";

describe("administrator member identity edits", () => {
  const members = [{ userId: "member-1", name: "윤태상", phone: "010-4908-3307" }];
  const oldProfile = { name: "김민준", phone: "010-2001-0001" };

  test("uses the administrator's renamed member instead of the stale profile", () => {
    expect(resolveMemberIdentity(members, "member-1", oldProfile).name).toBe("윤태상");
  });

  test("uses the administrator's updated telephone number", () => {
    expect(resolveMemberIdentity(members, "member-1", oldProfile).phone).toBe("010-4908-3307");
  });

  test("does not link a different account by matching name", () => {
    expect(resolveMemberIdentity(members, "another-user", { name: "윤태상", phone: "" }).member).toBeUndefined();
  });
});