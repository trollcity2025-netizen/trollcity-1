export function createPageUrl(page) {
  if (!page) return "/";
  const map = {
    Home: "/Home",
    Store: "/Store",
    Profile: "/Profile",
    Admin: "/Admin",
    Trending: "/Trending",
    Following: "/Following",
    Followers: "/Followers",
    Messages: "/Messages",
    GoLive: "/GoLive",
    PublicProfile: "/PublicProfile",
    StreamViewer: "/StreamViewer",
    Notifications: "/Notifications",
    NotificationsPage: "/NotificationsPage",
    Login: "/Login",

    TrollFamilyApplication: "/TrollFamilyApplication",
    PaymentRequired: "/PaymentRequired",
    KickBanFee: "/KickBanFee",
  };
  return map[page] || `/${String(page)}`;
}
