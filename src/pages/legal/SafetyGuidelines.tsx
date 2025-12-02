import React from 'react'
import LegalLayout from '../../components/LegalLayout'

export default function SafetyGuidelines() {
  return (
    <LegalLayout>
      <article className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-a:text-purple-300 prose-strong:text-slate-100">
        <p className="text-xs uppercase tracking-[0.15em] text-purple-300">
          Community
        </p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Safety & Community Guidelines
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Last updated: January 2025
        </p>

        <h2>Our Commitment to Safety</h2>
        <p>
          Troll City is committed to providing a safe, respectful, and enjoyable
          environment for all users. These guidelines outline expected behavior and
          the consequences of violations.
        </p>

        <h2>1. Prohibited Content and Behavior</h2>
        <p>
          The following are strictly prohibited and will result in immediate action:
        </p>
        <ul>
          <li><strong>Harassment and Bullying:</strong> Targeting individuals with
            repeated negative comments, threats, or intimidation</li>
          <li><strong>Hate Speech:</strong> Content promoting hatred, discrimination,
            or violence based on race, religion, gender, sexual orientation, or other
            protected characteristics</li>
          <li><strong>Explicit Content:</strong> Sexual content, nudity, or graphic
            material not appropriate for our platform</li>
          <li><strong>Self-Harm or Suicide:</strong> Content promoting, glorifying, or
            providing instructions for self-harm or suicide</li>
          <li><strong>Minors:</strong> Any content involving or targeting minors in
            inappropriate ways</li>
          <li><strong>Scams and Fraud:</strong> Attempting to defraud users, sell
            fake coins, or engage in financial scams</li>
          <li><strong>Impersonation:</strong> Pretending to be another user, admin,
            or public figure</li>
          <li><strong>Spam:</strong> Repetitive messages, unsolicited promotions,
            or automated bot activity</li>
        </ul>

        <h2>2. Moderation System</h2>
        <p>
          Troll City uses a multi-layered moderation approach:
        </p>
        <ul>
          <li><strong>Automated Systems:</strong> AI-powered content filtering and
            detection</li>
          <li><strong>Troll Officers:</strong> Trained human moderators who review
            reports and take action</li>
          <li><strong>Admin Review:</strong> Complex cases escalated to administrators</li>
          <li><strong>Observer Bot:</strong> AI system that grades moderation actions
            for quality and consistency</li>
        </ul>

        <h2>3. Reporting Violations</h2>
        <p>
          If you encounter content or behavior that violates these guidelines:
        </p>
        <ol>
          <li>Use the in-app reporting system to submit a report</li>
          <li>Provide as much context as possible (screenshots, timestamps, etc.)</li>
          <li>Reports are reviewed by Troll Officers or Admins</li>
          <li>You will receive a notification when action is taken</li>
        </ol>
        <p>
          <strong>Emergency Situations:</strong> Troll City is not an emergency service.
          If you or someone else is in immediate danger, contact local emergency
          services (911 in the US) immediately.
        </p>

        <h2>4. Enforcement Actions</h2>
        <p>
          Violations may result in one or more of the following actions:
        </p>
        <ul>
          <li><strong>Warning:</strong> First-time minor violations</li>
          <li><strong>Mute:</strong> Temporary restriction from chat or messaging</li>
          <li><strong>Shadow Ban:</strong> Your messages are hidden from others
            without your knowledge</li>
          <li><strong>Temporary Ban:</strong> Account suspension for a specified
            duration (hours, days, or weeks)</li>
          <li><strong>Permanent Ban:</strong> Permanent account termination</li>
          <li><strong>Coin Deduction:</strong> Violations may result in deduction
            of coins as a penalty</li>
        </ul>

        <h2>5. Appeal Process</h2>
        <p>
          If you believe you were banned or restricted in error:
        </p>
        <ol>
          <li>Contact support through the in-app support system</li>
          <li>Provide your account information and the reason for your appeal</li>
          <li>Include any relevant evidence or context</li>
          <li>Appeals are reviewed by administrators</li>
          <li>You will receive a response within 5-7 business days</li>
        </ol>

        <h2>6. Privacy and Personal Information</h2>
        <ul>
          <li>Do not share personal information (address, phone number, email,
            financial details) publicly</li>
          <li>Do not request personal information from other users</li>
          <li>Report any attempts to collect or misuse personal information</li>
          <li>Be cautious when interacting with users you don't know</li>
        </ul>

        <h2>7. Account Security</h2>
        <ul>
          <li>Use a strong, unique password</li>
          <li>Never share your account credentials</li>
          <li>Enable two-factor authentication if available</li>
          <li>Report suspicious activity immediately</li>
          <li>Log out from shared or public devices</li>
        </ul>

        <h2>8. Troll Officers</h2>
        <p>
          Troll Officers are community moderators who help maintain platform safety.
          They have the authority to:
        </p>
        <ul>
          <li>Warn users for violations</li>
          <li>Mute or temporarily ban users</li>
          <li>Submit reports for admin review</li>
          <li>Escalate serious violations</li>
        </ul>
        <p>
          Officers are trained and monitored. If you believe an officer acted
          inappropriately, report it to administrators.
        </p>

        <h2>9. Age Requirements</h2>
        <p>
          Troll City is intended for users 16 years and older. Users under 18 must
          have parental consent. We do not knowingly collect information from users
          under 16. If we discover a user is underage, their account will be
          immediately terminated.
        </p>

        <h2>10. Updates to Guidelines</h2>
        <p>
          These guidelines may be updated periodically to reflect changes in our
          platform, community standards, or legal requirements. Continued use of
          Troll City after updates constitutes acceptance of the revised guidelines.
        </p>

        <h2>11. Contact</h2>
        <p>
          For safety concerns, reporting violations, or questions about these guidelines,
          contact our support team through the in-app support system.
        </p>
      </article>
    </LegalLayout>
  )
}
