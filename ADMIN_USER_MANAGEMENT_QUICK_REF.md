# Admin Quick Reference - User Management System

## 🚀 Quick Start

### How to View Complete User Records

1. **Navigate**: Admin Dashboard → User Management OR User Forms tab
2. **Click**: Any username (must be admin or secretary)
3. **View**: Complete user record opens in modal

---

## 🔍 What You Can See

### Profile Information
- Avatar, username, role, level
- Full name, email, phone
- Troll coins (paid & free)
- Member since date
- Onboarding status

### Tax Information
- W-9 status (pending/submitted/verified)
- Legal name & address
- Submission & approval dates

### ID Verification
- Status with color-coded badges
- Document links to view uploads
- AI match scores
- Complete verification history

### Agreements
- All accepted agreements
- Version numbers
- Acceptance dates
- IP addresses

### Applications
- All submitted applications
- Types and statuses
- Submission dates

### Missing Items Alert
- **Red/Yellow/Blue indicators**
- Lists everything user needs to complete
- One-click "Prompt User" button

---

## 🎯 Quick Actions

### Prompt User to Complete Profile
1. Open user detail modal (click username)
2. See missing items in red banner at top
3. Click "Prompt User" button
4. User receives system notification listing all missing items

### View Uploaded Documents
- Click document URLs in modal
- Opens in new tab for security

---

## 🎨 Status Badge Colors

| Color | Meaning | Examples |
|-------|---------|----------|
| 🟢 Green | Approved/Complete | Verified, Approved, Complete |
| 🔴 Red | Rejected/Missing | Failed, Denied, Incomplete |
| 🟡 Yellow | Pending | Pending, Awaiting Review |
| 🔵 Blue | In Progress | Submitted, In Review |

---

## 🔒 Permissions

### Who Can View User Details?
- ✅ **Admins** (role: admin or is_admin: true)
- ✅ **Secretaries** (role: secretary)
- ❌ Regular users (no click access)

---

## 📋 Missing Items Checked

The system automatically detects:

1. ❌ **Missing Full Name** (Critical)
2. ❌ **Missing Email** (Critical)
3. ⚠️ **Missing Phone** (Warning)
4. ❌ **Onboarding Incomplete** (Critical)
5. ⚠️ **W-9 Not Verified** (Warning)
6. ❌ **Terms Not Accepted** (Critical)
7. ⚠️ **ID Not Verified** (Warning)

---

## 🎯 Typical Workflow

### New User Onboarding Check
```
1. Click username
2. Check missing items alert
3. If items missing → Click "Prompt User"
4. User receives notification
5. User completes items
6. Check again later
```

### Tax Form Review
```
1. Go to Tax Review tab
2. Review W-9 submission
3. Approve or reject
4. Status updates automatically
5. User receives notification
```

### ID Verification Review
```
1. Go to Verification Review tab
2. View uploaded ID + selfie
3. Check AI match score
4. Approve or reject
5. User's status updated instantly
```

---

## 💡 Pro Tips

1. **Use search bar** in User Management to find users quickly
2. **Filter by "Incomplete"** in User Forms tab to focus on users needing attention
3. **Check missing items count** before prompting (shown in red badge)
4. **Prompt users in batches** during maintenance windows to avoid notification overload
5. **Review verification history** to see if user has made multiple attempts

---

## 🚨 Important Notes

- **Data is live**: All information is real-time from database
- **Actions are immediate**: Approvals/rejections take effect instantly
- **Notifications are queued**: Users receive prompts within seconds
- **Document links are private**: Only admins/secretaries can access
- **Changes are logged**: All admin actions recorded in system logs

---

## 📱 Mobile Usage

- **Fully responsive** on all devices
- **Touch-friendly** buttons and links
- **Scrollable modals** for long content
- **Fast load times** even on slower connections

---

## 🆘 Troubleshooting

### Username not clickable?
- Check your role (must be admin or secretary)
- Refresh page and try again

### Modal not loading data?
- Check internet connection
- User may have no data in that section (normal)
- Refresh page and try again

### Prompt button not working?
- Check if user has missing items (button disabled if none)
- Verify you have notification permissions
- Check console for errors

---

## 📞 Need Help?

Refer to full documentation: `COMPREHENSIVE_AUDIT_COMPLETE.md`

---

**Last Updated**: 2025-01-08
**Version**: 1.0
**Status**: ✅ Production Ready
