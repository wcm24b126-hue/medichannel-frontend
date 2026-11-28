export type WorkspaceRole = "patient" | "doctor" | "manager" | "admin";

const ROLE_MAP = {
  CUSTOMER: "patient",
  DOCTOR: "doctor",
  MANAGER: "manager",
  ADMIN: "admin",
} as const satisfies Record<string, WorkspaceRole>;

const ROLE_DESTINATIONS: Record<WorkspaceRole, string> = {
  patient: "/appointments",
  doctor: "/doctor/dashboard",
  manager: "/manager/dashboard",
  admin: "/admin/dashboard",
};

export type WorkspaceSessionOutcome =
  | { status: "authenticated"; role: WorkspaceRole }
  | { status: "redirect"; destination: string }
  | { status: "error"; message: string };

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

/**
 * Verifies the active tab's bearer token against `/api/auth/me` before
 * rendering a protected Next.js workspace. Missing or rejected tokens clear
 * stale tab state and redirect to `/login` without touching cookies or
 * `localStorage`.
 */
export async function verifyWorkspaceSession(options: {
  expectedRole: WorkspaceRole;
  storage: StorageLike | null | undefined;
  fetchImpl?: typeof fetch;
}): Promise<WorkspaceSessionOutcome> {
  const { expectedRole, storage, fetchImpl = fetch } = options;

  let tabToken: string | null = null;
  try {
    tabToken = storage?.getItem("mc_tab_token") ?? null;
  } catch {
    tabToken = null;
  }

  if (!tabToken) {
    return { status: "redirect", destination: "/login" };
  }

  try {
    const response = await fetchImpl("/api/auth/me", {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${tabToken}`,
        "X-Medichannel-Tab": "1",
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        try {
          storage?.removeItem("mc_tab_token");
          storage?.removeItem("mc_tab_user");
        } catch {}
        return { status: "redirect", destination: "/login" };
      }
      return {
        status: "error",
        message:
          typeof data?.message === "string" && data.message
            ? data.message
            : "Unable to verify your session.",
      };
    }

    const resolvedRole = ROLE_MAP[data?.user?.role as keyof typeof ROLE_MAP];
    if (!resolvedRole) {
      return {
        status: "error",
        message: "The session has an unsupported role.",
      };
    }

    if (resolvedRole !== expectedRole) {
      return {
        status: "redirect",
        destination: ROLE_DESTINATIONS[resolvedRole],
      };
    }

    return { status: "authenticated", role: resolvedRole };
  } catch (error: unknown) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Unable to verify your session.",
    };
  }
}
