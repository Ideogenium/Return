# Return Privacy Policy

Last updated: October 31, 2026

Return is a mobile app that helps individuals keep track of the items and money they lend or borrow. This page
explains in plain terms what data the app uses, why, who can see it, and how to exercise your rights.

## 1. Who is responsible for your data?

<!-- À COMPLÉTER AVANT PUBLICATION : nom et adresse du responsable du traitement -->

The data controller is the Return team (Ideogen project):

- [Controller name]
- [Postal address]

For any question about your data:

- egbedozin@gmail.com
- nathan.aihou@gmail.com

## 2. What data do we collect?

### Your account data

Provided by you when you sign up or edit your profile:

- first name, last name and email address;
- password: we only store it in hashed (unreadable) form, never in clear text;
- phone number and profile picture, both optional;
- your preferences: push notifications, reminders, language and time zone.

We also record when your account was created and when you last logged in.

### Your contacts (third-party data)

When you add a contact (for example someone you lend something to), you enter their first name, last name, email
address and, optionally, phone number. This is information about other people that you enter yourself. Return does
not read your phone's address book. If you add someone, please make sure they are aware of it. You can also send an
invitation to another registered user, who can accept or decline it.

### Your items and photos

The name, description, category and estimated value of the lent item, and the photos you attach (taken with the
camera or chosen from your photo library).

**Important: photo visibility.** Photos (items and profile picture) are stored on Cloudflare R2 and served through
public web addresses (URLs). These addresses are long and not guessable, but they require no authentication: anyone
who has the link can view the photo. Please avoid photographing identity documents, bank documents or any sensitive
information. After a photo is deleted, a delivery cache may keep serving it for a limited time (around one day).

### Your loans

The item or amount lent, dates (loan, expected return, actual return), loan status, any notes and, if a borrower
contests a loan, the reason for the contestation.

### Reminders and notifications

The automatic reminders and notifications sent about a loan (title, text, read or unread state). To deliver push
notifications, we store your device token (a technical identifier provided by your phone) and its platform (iOS or
Android).

### Statistics and trust score

From your loan history, Return computes statistics (number of loans, returns on time, late or not returned, average
return delay) and a trust score (see section 4).

### Technical data

- server technical logs, which include a request identifier and, when you are logged in, your internal user
  identifier;
- your IP address, which the server uses to limit the number of requests and login attempts;
- session tokens (see section 7).

## 3. Why do we use your data?

| Purpose | Legal basis (GDPR) |
| --- | --- |
| Create your account and manage your loans, contacts, items, photos, reminders, history and statistics | Performance of the service you requested (contract) |
| Keep the service secure: rate limiting of requests and login attempts, technical logs, error detection | Legitimate interest (protecting the service and its users) |
| Send push notifications | Your consent, given through your phone's notification permission; you can withdraw it at any time in your phone or app settings |

We do not use your data for any other purpose.

## 4. What other users can see

- **The borrower** (if they have a Return account) sees the loans that concern them and their status. They also see
  the lender's name.
- **The lender** sees the contact details they entered for their borrower, and the loans made to that person.
- A user cannot see your other contacts, other loans or other items.
- **Trust score**: for each borrower, Return automatically computes a score from returns on time, late returns and
  items not returned (contested and ongoing loans are not counted). This is simple profiling: it only informs the
  lender, and no decision with legal effect is made automatically. You can object to this calculation or contest a
  result by writing to us (section 8).

## 5. No advertising and no tracking

Return contains no advertising, does not sell your data, and uses no advertising trackers or third-party analytics
tools.

## 6. Who processes your data on our behalf?

We rely on the following providers:

- **Fly.io**: hosting of the API and the database (application deployed in the Paris, France region).
- **Upstash** (Redis, Paris, France region): temporary storage of revoked session identifiers and deleted-account
  markers, without the content of your loans.
- **Cloudflare R2**: storage of photos.
- **Expo** (push notification service): relays push notifications, which contain their title and text and the
  device token.
- **Google Firebase Cloud Messaging** (Android) and **Apple Push Notification service** (iOS): deliver
  notifications to your phone.

Some of these providers may process data outside the European Union, notably in the United States. In that case,
the transfer relies on appropriate safeguards provided by the GDPR, such as the European Commission's standard
contractual clauses or, where applicable, an adequacy decision.

## 7. How long do we keep your data?

- **As long as your account exists**: your data is kept to run the service.
- **Sessions**: login relies on a 15-minute access token and a 30-day refresh token, stored only in hashed form.
  Logging out revokes it.
- **Account deletion**: you can delete your account at any time (section 8). Your personal data is then erased or
  pseudonymized, but erasure is not total when completed loans must be kept for the other party: a completed loan is also part of the other person's history, and they should not lose it.
  - Your sessions, device tokens, notifications, invitations, and any items and contacts that no one needs anymore
    are deleted. Stored photos are deleted.
  - Your completed loans whose borrower has a Return account are kept for that person in pseudonymized form: your
    name becomes "Deleted account", your email address, password, phone number and profile picture are erased, and
    the free text you wrote (item descriptions, loan notes) is emptied. The lent item (name, category, value), the
    dates and the status remain visible to the other person. A contestation reason written by a borrower is kept to
    explain the loan's status to the lender.
  - If you were a borrower: the contact records that lenders had created in your name remain with those lenders (the
    name they entered and the history of their loans), but the email address and phone number on those records are
    erased and they are no longer linked to any account. Signing up again with the same email address does not
    recover that history; a lender who invites you again creates a new record.
  - Notifications sent to other users that name you are deleted.
  - If no loan needs to be kept, the account is deleted entirely.
  - Ongoing loans must be closed before a lender account can be deleted.
- **Technical logs**: kept for a limited period, only for security and troubleshooting.

## 8. Your rights and how to exercise them

You have the right to access, rectify, erase, restrict, object to the processing of, and port your data.

- **Edit your information and delete your account**: directly in the app, Profile tab ("Delete my account", with
  password confirmation).
- **All other rights** (access, copy of your data, restriction, objection, contesting the trust score): write to
  egbedozin@gmail.com or nathan.aihou@gmail.com. We will reply within one month. We may ask you to prove your
  identity.
- **Complaint**: if you believe your rights are not respected, you can lodge a complaint with the CNIL, the French
  data protection authority (https://www.cnil.fr), or with your local authority.

If you are a contact entered by another user, the same rights apply: write to us.

## 9. Security

- Communication with the server is encrypted (HTTPS).
- Passwords are stored hashed (bcrypt); refresh tokens are stored hashed.
- Session tokens can be revoked (logout, account deletion).
- Data is only accessible to those who need it to operate the service.
- A limitation to be aware of: photos can be viewed by anyone who has their link (see section 2).

No system is infallible, but we take these measures to protect your data.

## 10. Minors

Return is intended for people aged 18 and over. We do not knowingly collect data from minors.

## 11. Changes to this policy

We may update this policy, for example when a feature is added. The date of the last update appears at the top of
this page. For significant changes, we will let you know in the app or by email.
