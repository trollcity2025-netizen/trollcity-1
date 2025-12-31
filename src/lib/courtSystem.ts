export interface CourtSession {
  id: string;
  startedAt: Date;
  status: "active" | "ended";
  judge: {
    id: string;
    name: string;
    role: "admin" | "lead_troll_officer" | "troll_officer";
  };
  summoned: SummonedUser[];
  appealed: AppeaUser[];
}

export interface SummonedUser {
  userId: string;
  username: string;
  reason: string;
  summonedAt: Date;
  joinedAt?: Date;
  verdict?: "guilty" | "not_guilty";
  penalty?: string;
}

export interface AppeaUser {
  userId: string;
  username: string;
  originalPenalty: string;
  appealReason: string;
  appealedAt: Date;
  status: "pending" | "approved" | "denied";
  verdict?: string;
}

export interface Warrant {
  userId: string;
  username: string;
  reason: string;
  issuedAt: Date;
  ipBanned: boolean;
  allowedToAppeal: boolean;
}

export interface AdminAction {
  userId: string;
  username: string;
  action: "kick" | "ban" | "suspend" | "ip_ban" | "suspend_payouts" | "disable_chat";
  duration?: number;
  reason: string;
  executedBy: string;
  executedAt: Date;
}

export const courtSystem = {
  activeSessions: new Map<string, CourtSession>(),
  warrants: new Map<string, Warrant>(),
  adminActions: new Map<string, AdminAction[]>(),
  
  startCourtSession(judge: CourtSession["judge"], summoned: string[]): CourtSession {
    const session: CourtSession = {
      id: `court-${Date.now()}`,
      startedAt: new Date(),
      status: "active",
      judge,
      summoned: summoned.map(username => ({
        userId: `user-${username}`,
        username,
        reason: "Summoned to Court",
        summonedAt: new Date(),
      })),
      appealed: [],
    };

    this.activeSessions.set(session.id, session);
    
    setTimeout(() => {
      this.checkMissingParticipants(session.id);
    }, 15 * 60 * 1000);

    return session;
  },

  joinCourt(sessionId: string, userId: string, username: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const summoned = session.summoned.find(s => s.userId === userId);
    if (summoned) {
      summoned.joinedAt = new Date();
    }
  },

  checkMissingParticipants(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.summoned.forEach(summoned => {
      if (!summoned.joinedAt) {
        this.issueWarrant(summoned.userId, summoned.username, "Failed to appear in court");
      }
    });
  },

  issueWarrant(userId: string, username: string, reason: string) {
    const warrant: Warrant = {
      userId,
      username,
      reason,
      issuedAt: new Date(),
      ipBanned: false,
      allowedToAppeal: true,
    };

    this.warrants.set(userId, warrant);
  },

  executeAdminAction(action: AdminAction) {
    if (!this.adminActions.has(action.userId)) {
      this.adminActions.set(action.userId, []);
    }

    this.adminActions.get(action.userId)!.push(action);

    if (action.action === "kick") {
      return { type: "kick", redirectTo: "/kick-fee" };
    }

    if (action.action === "ban") {
      return { type: "ban", redirectTo: "/ban-fee" };
    }

    if (action.action === "ip_ban") {
      return { type: "ip_ban", action: "logout" };
    }

    if (action.action === "suspend") {
      return { type: "suspend", duration: action.duration };
    }

    if (action.action === "suspend_payouts") {
      return { type: "suspend_payouts" };
    }

    if (action.action === "disable_chat") {
      return { type: "disable_chat" };
    }

    return null;
  },

  trackKickCount(userId: string): number {
    const actions = this.adminActions.get(userId) || [];
    return actions.filter(a => a.action === "kick").length;
  },

  shouldAutoIPBan(userId: string): boolean {
    return this.trackKickCount(userId) >= 3;
  },

  appealWarrant(userId: string, username: string, reason: string): boolean {
    const warrant = this.warrants.get(userId);
    if (!warrant || !warrant.allowedToAppeal) return false;

    return true;
  },

  approveAppeal(userId: string, username: string) {
    const warrant = this.warrants.get(userId);
    if (warrant) {
      warrant.ipBanned = false;
      this.warrants.delete(userId);
    }
  },
};
