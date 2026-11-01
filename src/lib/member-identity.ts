type LinkedMember = { userId?: string | null; name: string; phone: string };

/** Mutable names must never be used to link an account to its member row. */
export function resolveMemberIdentity<T extends LinkedMember>(
  members: T[],
  userId: string | undefined,
  profile: { name: string; phone: string },
) {
  const member = userId ? members.find((item) => item.userId === userId) : undefined;
  return {
    member,
    name: member?.name ?? profile.name,
    phone: member?.phone ?? profile.phone,
  };
}