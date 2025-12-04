# User Personas and Stories Specification
## Community Social Network - Serbian Agentics Foundation & StartIT

**Document Version**: 1.0
**Date**: 2025-12-04
**Phase**: SPARC Specification (Phase 1 - Requirements Analysis)
**Status**: Draft for Review

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Personas](#user-personas)
3. [User Stories](#user-stories)
4. [User Journey Maps](#user-journey-maps)
5. [Acceptance Criteria](#acceptance-criteria)
6. [MoSCoW Prioritization](#moscow-prioritization)
7. [Validation Metrics](#validation-metrics)

---

## Executive Summary

This document defines the user personas, stories, and journeys for the Community Social Network platform serving the Serbian Agentics Foundation and StartIT communities. The platform aims to create an engaging, safe, and productive space for AI enthusiasts, developers, and technology professionals in Serbia.

**Key Success Metrics**:
- 80% user activation rate (complete profile + first interaction within 7 days)
- 60% monthly active user retention after 90 days
- Average 3+ community interactions per active user per week
- 4.5+ user satisfaction score (out of 5)

---

## User Personas

### Persona 1: Marko - The Community Member (Casual User)

**Demographics**:
- **Age**: 28
- **Location**: Belgrade, Serbia
- **Occupation**: Software Developer at a local startup
- **Education**: Bachelor's in Computer Science
- **Tech Proficiency**: High (daily GitHub, Stack Overflow user)
- **Languages**: Serbian (native), English (fluent)

**Background**:
Marko has been coding for 5 years and is curious about AI/ML but hasn't specialized in it yet. He follows tech trends and wants to learn from the community without feeling overwhelmed by academic papers or advanced discussions.

**Goals**:
- Learn about AI/ML applications in practical projects
- Network with other developers interested in AI
- Stay updated on local tech events and opportunities
- Contribute to discussions when he has relevant experience
- Find mentorship or collaboration opportunities

**Pain Points**:
- Overwhelmed by too many notifications or irrelevant content
- Hesitant to post questions (fear of looking inexperienced)
- Struggles to find beginner-friendly AI content in Serbian
- Limited time (prefers mobile browsing during commute)
- Gets lost in large, unorganized discussion threads

**Behaviors**:
- Logs in 2-3 times per week, mostly on mobile
- Prefers reading/lurking over posting (80/20 ratio)
- Follows specific topics rather than individuals
- Bookmarks useful content for later reference
- Responds to direct mentions but rarely initiates threads

**Technology Usage**:
- Primary Device: Mobile (iOS/Android)
- Usage Time: Morning commute (7-8 AM), lunch break (1-2 PM)
- Preferred Features: Feed scrolling, topic filtering, bookmark lists
- Accessibility Needs: Good mobile UX, offline content caching

**Quote**: "I want to learn from the community without feeling like I'm back in university lectures."

---

### Persona 2: Jelena - The Content Creator (Active Poster)

**Demographics**:
- **Age**: 32
- **Location**: Novi Sad, Serbia
- **Occupation**: AI Research Engineer at international company (remote)
- **Education**: Master's in Machine Learning
- **Tech Proficiency**: Expert (conference speaker, blog author)
- **Languages**: Serbian (native), English (fluent), German (conversational)

**Background**:
Jelena has 8 years of experience in AI/ML, including research publications and production system deployments. She's passionate about knowledge sharing and building the AI community in Serbia. She balances full-time work with community engagement and personal projects.

**Goals**:
- Share insights from her work and research
- Establish thought leadership in the local AI community
- Connect with potential collaborators for side projects
- Give back to the community that helped her career
- Discover talented individuals for potential hiring
- Organize and promote online workshops/meetups

**Pain Points**:
- Time-consuming to format technical content (code snippets, diagrams)
- Difficult to gauge content impact (views, engagement)
- Receives repetitive questions in comments
- Struggles to find quality discussions among noise
- Wants to cross-post content to LinkedIn/Medium
- Concerned about content being misused without attribution

**Behaviors**:
- Posts 2-3 high-quality articles/tutorials per month
- Responds to comments and questions actively
- Curates and shares external resources
- Uses desktop for content creation, mobile for quick responses
- Engages daily with the platform (30-60 minutes)
- Values data on content performance

**Technology Usage**:
- Primary Device: Desktop for posting, mobile for engagement
- Usage Time: Evening hours (7-10 PM), weekends for deep work
- Preferred Features: Rich text editor, analytics dashboard, notification center
- Accessibility Needs: Markdown support, code syntax highlighting, draft saving

**Quote**: "I want to help others learn, but I need tools that respect my time and amplify my impact."

---

### Persona 3: Stefan - The Group Leader/Moderator

**Demographics**:
- **Age**: 35
- **Location**: Belgrade, Serbia
- **Occupation**: Engineering Manager at a tech company
- **Education**: PhD in Computer Science (in progress)
- **Tech Proficiency**: Expert (community organizer, mentor)
- **Languages**: Serbian (native), English (fluent)

**Background**:
Stefan founded the "AI & Ethics" special interest group and moderates the "NLP Serbia" community. He has extensive experience managing online communities and organizing local AI meetups. He volunteers 5-10 hours per week for community moderation.

**Goals**:
- Foster healthy, productive discussions in his groups
- Onboard new members and make them feel welcome
- Enforce community guidelines fairly and consistently
- Organize virtual events and coordinate with other group leaders
- Identify and empower emerging community leaders
- Scale moderation without burning out

**Pain Points**:
- Time-intensive manual moderation tasks
- Difficult to spot toxic behavior early
- Lacks tools for member engagement analytics
- Challenges coordinating with co-moderators
- No easy way to schedule/announce events
- Struggles with repeat policy violators

**Behaviors**:
- Logs in daily to review flagged content and member reports
- Spends 60-90 minutes per day on moderation tasks
- Uses both mobile and desktop depending on task complexity
- Creates weekly discussion prompts and challenges
- Monitors group health metrics (active members, post frequency)
- Regularly communicates with other group leaders

**Technology Usage**:
- Primary Device: Desktop for moderation, mobile for quick checks
- Usage Time: Morning check (7-8 AM), evening moderation (8-10 PM)
- Preferred Features: Moderation queue, member management, event tools, analytics
- Accessibility Needs: Bulk actions, keyboard shortcuts, mobile mod tools

**Quote**: "I want to build a thriving community, not spend all my time playing whack-a-mole with spam."

---

### Persona 4: Ana - The Community Admin

**Demographics**:
- **Age**: 29
- **Location**: Belgrade, Serbia
- **Occupation**: Community Manager at Serbian Agentics Foundation
- **Education**: Master's in Digital Marketing and Communications
- **Tech Proficiency**: Intermediate-High (power user, not a developer)
- **Languages**: Serbian (native), English (fluent)

**Background**:
Ana is responsible for the overall health, growth, and engagement of the entire Community Social Network. She works closely with the Serbian Agentics Foundation leadership and StartIT to align community strategy with organizational goals. She manages a budget for community initiatives and events.

**Goals**:
- Grow active membership by 20% quarter-over-quarter
- Maintain high community health scores (low toxicity, high engagement)
- Support and coordinate group leaders/moderators
- Organize platform-wide events and campaigns
- Monitor platform security and compliance issues
- Report community metrics to stakeholders
- Ensure platform aligns with Foundation values

**Pain Points**:
- Lacks comprehensive admin dashboard for platform-wide insights
- Difficult to identify at-risk groups or declining engagement
- Time-consuming to communicate policy updates to all moderators
- Needs better tools for user lifecycle management
- Struggles to measure ROI of community initiatives
- Concerned about GDPR compliance and data protection
- Wants to prevent platform abuse without hindering genuine users

**Behaviors**:
- Reviews daily/weekly/monthly analytics reports
- Conducts regular check-ins with group leaders
- Responds to escalated moderation issues
- Plans and executes community campaigns
- Manages platform announcements and updates
- Coordinates with technical team on feature requests
- Engages with key community members personally

**Technology Usage**:
- Primary Device: Desktop for admin work, mobile for monitoring
- Usage Time: Business hours (9 AM - 6 PM), some evening monitoring
- Preferred Features: Admin dashboard, user management, analytics, announcement system
- Accessibility Needs: Export capabilities, role-based permissions, audit logs

**Quote**: "I need to see the big picture and intervene when necessary, without micromanaging every detail."

---

### Persona 5: Nina - The New Member (Onboarding Journey)

**Demographics**:
- **Age**: 24
- **Location**: Niš, Serbia
- **Occupation**: Junior Frontend Developer
- **Education**: Bachelor's in Information Technology (recent graduate)
- **Tech Proficiency**: Intermediate (knows basics, learning daily)
- **Languages**: Serbian (native), English (intermediate)

**Background**:
Nina just graduated and landed her first developer job. She heard about the Serbian Agentics Foundation community from a colleague and wants to learn about AI to advance her career. She's nervous about joining tech communities because she feels inexperienced and worries about making mistakes.

**Goals**:
- Learn what AI/ML is and how it relates to frontend development
- Find beginner-friendly resources and tutorials
- Connect with other junior developers in similar situations
- Ask questions without judgment
- Discover local tech events and job opportunities
- Build confidence to participate in discussions

**Pain Points**:
- Overwhelmed by signup process if it requires too much information
- Doesn't know where to start or what groups to join
- Afraid of asking "stupid" questions
- Confused by technical jargon and abbreviations
- Unsure of community norms and etiquette
- Worried about privacy (employer seeing her activity)

**Behaviors**:
- Completes onboarding only if it's quick and clear
- Lurks for 1-2 weeks before posting anything
- Joins groups recommended during onboarding
- Follows topics that match her interests
- Prefers visual guides over text-heavy documentation
- Checks platform on mobile during breaks

**Technology Usage**:
- Primary Device: Mobile (Android)
- Usage Time: Lunch breaks (12-1 PM), evenings (7-9 PM)
- Preferred Features: Simple onboarding, topic suggestions, beginner-friendly tags
- Accessibility Needs: Intuitive UI, tooltips, progress indicators

**Quote**: "I want to be part of the community, but I need help figuring out where I fit in."

---

## User Stories

### Epic 1: User Registration and Onboarding

#### Story 1.1: Account Creation
**As a** new member (Nina)
**I want to** create an account quickly with minimal required information
**So that** I can join the community without friction or privacy concerns

**Priority**: Must Have
**Complexity**: Small (2 story points)

**Acceptance Criteria**:
- User can register with email + password OR social login (Google/GitHub)
- Required fields: Name, Email, Password (min 8 chars, 1 uppercase, 1 number)
- Optional fields: Bio, Location, Profile Picture
- Email verification sent within 30 seconds
- Account created and user logged in within 2 minutes of starting registration
- Password strength indicator shown in real-time
- GDPR consent checkbox with link to privacy policy
- Clear error messages for validation failures

---

#### Story 1.2: Interest Selection
**As a** new member (Nina)
**I want to** select my areas of interest during onboarding
**So that** the platform can recommend relevant groups and content

**Priority**: Must Have
**Complexity**: Medium (3 story points)

**Acceptance Criteria**:
- User presented with 15-20 interest tags (AI/ML, NLP, Computer Vision, Ethics, Web Dev, etc.)
- User must select at least 3 interests, maximum 10
- Visual feedback on selection (checkmark, color change)
- "Skip for now" option available
- Selected interests saved to user profile
- Used for initial content feed personalization
- Can be updated later in profile settings

---

#### Story 1.3: Group Recommendations
**As a** new member (Nina)
**I want to** receive personalized group recommendations
**So that** I can find communities aligned with my interests

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- After interest selection, show 5-10 recommended groups
- Groups sorted by relevance to selected interests + popularity
- Each group shows: name, member count, description (50 chars), recent activity indicator
- User can join groups directly from onboarding flow
- User can skip and browse later
- At least 2 "beginner-friendly" groups recommended for new users
- Onboarding completion tracked (joined at least 1 group = activated)

---

#### Story 1.4: Welcome Tour
**As a** new member (Nina)
**I want to** take a brief interactive tour of key features
**So that** I understand how to use the platform effectively

**Priority**: Should Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Optional 5-step tour with dismissable tooltips
- Tour highlights: Feed, Groups, Notifications, Profile, Post Creation
- User can skip, restart, or complete tour
- Tour progress saved (resume if interrupted)
- Completion tracked as onboarding metric
- Tour accessible later from help menu
- Mobile-responsive tour with swipe gestures

---

### Epic 2: Content Discovery and Consumption

#### Story 2.1: Personalized Feed
**As a** community member (Marko)
**I want to** see a personalized feed of relevant posts
**So that** I can quickly find content that interests me

**Priority**: Must Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Feed shows posts from joined groups, followed topics, and followed users
- Posts sorted by: Relevance (default), Recent, Popular (last 24h/7d/30d)
- Infinite scroll with lazy loading (20 posts per page)
- Each post shows: author, timestamp, group, content preview, engagement metrics
- "Mute" option for posts/topics/users
- Pull-to-refresh on mobile
- Empty state with recommendations if no content available
- Feed loads in under 2 seconds on 4G connection

---

#### Story 2.2: Topic Filtering
**As a** community member (Marko)
**I want to** filter my feed by specific topics or groups
**So that** I can focus on content relevant to my current interests

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Filter bar accessible from feed header
- Filters: All Groups, Specific Group(s), Topics, Post Type (discussion/question/tutorial/event)
- Multi-select filters with AND/OR logic
- Applied filters shown as removable chips
- Filter state persists during session
- "Save filter" option to create custom feed views
- Filter reset button
- Filter results update in under 1 second

---

#### Story 2.3: Bookmarking Content
**As a** community member (Marko)
**I want to** bookmark posts for later reading
**So that** I can save valuable content without losing track of it

**Priority**: Should Have
**Complexity**: Small (3 story points)

**Acceptance Criteria**:
- Bookmark icon visible on every post (heart or flag icon)
- One-click to bookmark/unbookmark
- Visual feedback on action (animation + confirmation)
- "Saved" collection accessible from user profile
- Saved posts organized by date saved (most recent first)
- Option to add notes to bookmarks (private)
- Option to organize bookmarks into custom collections
- Bookmarks sync across devices

---

#### Story 2.4: Search Functionality
**As a** community member (Marko)
**I want to** search for posts, users, and groups
**So that** I can find specific information quickly

**Priority**: Must Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Global search bar in header (accessible on all pages)
- Search types: All, Posts, Users, Groups, Topics
- Search results grouped by type with counts
- Autocomplete suggestions as user types (debounced 300ms)
- Advanced search filters: date range, author, group, topic, post type
- Search results sorted by relevance (default) or date
- Results load in under 1.5 seconds
- Search history saved (last 10 searches, clearable)
- Mobile: full-screen search interface

---

### Epic 3: Content Creation and Engagement

#### Story 3.1: Create Text Post
**As a** content creator (Jelena)
**I want to** create rich text posts with formatting
**So that** I can share knowledge effectively

**Priority**: Must Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Rich text editor with toolbar (bold, italic, headers, lists, quotes, code blocks)
- Markdown support (toggle between WYSIWYG and Markdown mode)
- Code syntax highlighting for 20+ languages
- Inline image/file upload (drag-and-drop or file picker)
- Link preview generation (auto-fetch title/description/thumbnail)
- Character limit: 50,000 characters
- Auto-save drafts every 30 seconds
- Post visibility options: Public, Group Only, Followers Only
- Tag/topic selection (required, min 1, max 5)
- Preview before posting
- Mobile: simplified editor with essential formatting

---

#### Story 3.2: Add Media to Posts
**As a** content creator (Jelena)
**I want to** include images, videos, and files in my posts
**So that** I can make content more engaging and informative

**Priority**: Must Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Image upload: JPG, PNG, GIF, WebP (max 10MB each, max 10 images)
- Video upload: MP4, WebM (max 100MB, max 2 videos)
- File upload: PDF, ZIP, TXT, MD (max 50MB, max 5 files)
- Drag-and-drop upload with progress indicator
- Image editing: crop, rotate, add alt text (accessibility)
- Video thumbnail auto-generated
- File virus scanning before upload completion
- Alt text required for images (accessibility)
- Media preview in post editor
- Mobile: access camera/gallery directly

---

#### Story 3.3: Comment on Posts
**As a** community member (Marko)
**I want to** comment on posts to join discussions
**So that** I can engage with the community

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Comment box below each post
- Rich text formatting (basic: bold, italic, code, links)
- Nested comments (threaded discussions, max 5 levels)
- Reply directly to specific comments
- Mentions: @username triggers notification
- Edit own comments within 15 minutes (edit history visible to mods)
- Delete own comments (replaced with "[deleted]" if has replies)
- Upvote/downvote comments
- Sort comments: Top, Recent, Oldest
- "Load more comments" button for posts with 20+ comments

---

#### Story 3.4: React to Content
**As a** community member (Marko)
**I want to** react to posts and comments with emojis
**So that** I can express sentiment quickly without writing a comment

**Priority**: Should Have
**Complexity**: Small (3 story points)

**Acceptance Criteria**:
- 8 reaction types: Like (👍), Love (❤️), Insightful (💡), Celebrate (🎉), Support (🙌), Thinking (🤔), Question (❓), Thanks (🙏)
- One-click to add reaction
- User can add multiple different reactions
- Click again to remove reaction
- Reaction count shown on post/comment
- Hover to see who reacted (max 50 users, then "and X others")
- Reactions shown in order of popularity
- Mobile: long-press to see reaction picker

---

#### Story 3.5: Share Content
**As a** content creator (Jelena)
**I want to** share posts to external platforms or within the community
**So that** I can amplify valuable content

**Priority**: Should Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Share options: Copy Link, LinkedIn, Twitter/X, Facebook, WhatsApp, Email
- Internal share: Repost to different group (with original attribution)
- Generate Open Graph preview for social media
- Share modal with preview of what will be shared
- Track share count on posts (for creator analytics)
- Option to add comment when reposting internally
- Share analytics: which platforms most used

---

### Epic 4: Group Management and Moderation

#### Story 4.1: Create New Group
**As a** group leader (Stefan)
**I want to** create a new community group
**So that** I can build a focused community around a specific topic

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Group creation form: Name, Description, Avatar, Cover Image, Topics (tags)
- Group type: Open (anyone can join), Closed (request to join), Secret (invite-only)
- Content visibility: Public (visible to all), Members Only
- Set group rules (free text, max 5,000 chars)
- Assign co-moderators during creation (optional)
- Group URL slug: auto-generated from name, editable
- Group discovery settings: Allow search indexing (yes/no)
- Default member permissions: Can post (yes/no), Can comment (yes/no)
- Group creation requires email verification + account age >7 days (anti-spam)

---

#### Story 4.2: Moderate Content
**As a** group leader (Stefan)
**I want to** review and moderate posts and comments
**So that** I can maintain community quality and safety

**Priority**: Must Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Moderation queue shows: Reported content, Flagged by AI, Pending approval (for closed groups)
- Queue items show: Content, Author, Reporter, Reason, Timestamp
- Moderator actions: Approve, Remove, Remove + Warn User, Remove + Ban User (temp/permanent)
- Bulk actions: Select multiple items, apply action
- Removal reasons: Spam, Harassment, Off-topic, Misinformation, Hate Speech, Other (custom)
- Removed content visible to mods with strike-through (audit trail)
- Action log: All mod actions recorded with timestamp and moderator name
- Auto-remove content after 3 reports (pending mod review)
- Mobile: simplified moderation queue with essential actions

---

#### Story 4.3: Manage Members
**As a** group leader (Stefan)
**I want to** manage group membership and permissions
**So that** I can build a healthy community

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Member list shows: Name, Join Date, Activity Level, Role
- Search/filter members by name, role, activity
- Member actions: Promote to Moderator, Demote, Mute, Kick, Ban
- Mute: User can read but not post/comment (temp or permanent)
- Ban: User removed and cannot rejoin (can be time-limited)
- Bulk member import via CSV (for migration)
- Export member list as CSV (for backups)
- Join request queue for closed groups (approve/reject)
- Welcome message auto-sent to new members (customizable)

---

#### Story 4.4: Configure Group Settings
**As a** group leader (Stefan)
**I want to** configure group rules and automation
**So that** I can reduce manual moderation work

**Priority**: Should Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Post approval: None, All Posts, New Members Only, Keyword Filter
- Keyword filter: Block/flag posts containing specified words (regex support)
- Auto-moderation rules: Remove posts with X reports, Flag posts from new accounts
- Posting restrictions: Min account age, Min karma score, Email verification required
- Content rules: Allow/disallow images, videos, links, polls
- Member restrictions: Max posts per day per user (anti-spam)
- Scheduled posts: Allow mods to schedule announcement posts
- Pin posts: Max 3 pinned posts at top of group feed

---

### Epic 5: Notifications and Communication

#### Story 5.1: In-App Notifications
**As a** community member (Marko)
**I want to** receive notifications for relevant activity
**So that** I can stay engaged without constantly checking the platform

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Notification types: Mentions, Replies, Reactions, Follows, Group Invites, Announcements
- Notification center accessible from header bell icon
- Unread count badge on notification icon
- Notifications grouped by type and time (Today, Yesterday, This Week, Older)
- Mark individual or all notifications as read
- Click notification to navigate to related content
- Notification settings: Enable/disable by type, frequency (real-time, hourly digest, daily digest)
- Delete notifications individually or bulk
- Notifications load in under 1 second

---

#### Story 5.2: Email Notifications
**As a** community member (Marko)
**I want to** receive email notifications for important activity
**So that** I can stay connected even when not on the platform

**Priority**: Should Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Email notification types: Direct Mentions, Direct Messages, Weekly Digest, Monthly Highlights
- Notification preferences per type: Immediate, Daily Digest, Weekly Digest, Off
- Email template: Professional, branded, mobile-responsive
- Email includes: Event description, Actor (who triggered it), Link to content, Unsubscribe link
- One-click unsubscribe (no login required)
- Digest emails: Grouped by notification type, max 1 email per period
- Email delivery within 5 minutes for immediate notifications
- Respect user timezone for digest sending time (default 9 AM)

---

#### Story 5.3: Push Notifications
**As a** content creator (Jelena)
**I want to** receive push notifications on mobile
**So that** I can respond quickly to important community activity

**Priority**: Could Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Push notification support for iOS and Android (PWA)
- User prompted to enable push on first mobile login
- Notification types: High Priority only (Mentions, Direct Messages, Group Announcements)
- Push settings separate from email/in-app settings
- Push notifications respect device Do Not Disturb mode
- Notification content: Title, body (max 120 chars), thumbnail image
- Deep link to relevant content on notification tap
- Push delivery within 30 seconds of event

---

### Epic 6: User Profile and Reputation

#### Story 6.1: View User Profile
**As a** community member (Marko)
**I want to** view other users' profiles
**So that** I can learn about their expertise and contributions

**Priority**: Must Have
**Complexity**: Medium (3 story points)

**Acceptance Criteria**:
- Profile shows: Avatar, Name, Bio, Location, Join Date, Website/Social Links
- Activity summary: Total posts, comments, reactions received, groups joined
- Recent activity feed (last 20 posts/comments)
- Reputation score (karma) based on engagement quality
- Badges/achievements (e.g., "Top Contributor", "First Post", "Helpful")
- Follow/Unfollow button
- Block/Report user options
- Privacy controls: User can hide profile from non-members

---

#### Story 6.2: Edit Own Profile
**As a** community member (Marko)
**I want to** customize my profile
**So that** I can represent myself accurately to the community

**Priority**: Must Have
**Complexity**: Small (3 story points)

**Acceptance Criteria**:
- Editable fields: Name, Bio (max 500 chars), Location, Avatar, Cover Image, Website, Social Links
- Avatar upload: JPG/PNG, max 5MB, auto-crop to square
- Preview changes before saving
- Social links: LinkedIn, GitHub, Twitter, personal website
- Privacy settings: Profile visibility (Public, Members Only, Private)
- Email change requires re-verification
- Password change requires current password confirmation
- Delete account option (with confirmation and 14-day grace period)

---

#### Story 6.3: Reputation System
**As a** content creator (Jelena)
**I want to** earn reputation points for valuable contributions
**So that** I feel recognized and motivated to continue contributing

**Priority**: Should Have
**Complexity**: Large (8 story points)

**Acceptance Criteria**:
- Reputation points (karma) earned from: Post upvotes (+10), Comment upvotes (+5), Reactions received (+2), Accepted answers (+20)
- Reputation lost from: Downvotes (-5), Content removed by mods (-20), Violations (-50)
- Reputation levels: Newcomer (0-99), Member (100-499), Contributor (500-1,999), Expert (2,000-4,999), Leader (5,000+)
- Level unlocks privileges: New Member (read-only), Member (post/comment), Contributor (create groups), Expert (edit others' posts), Leader (platform-wide mod tools)
- Leaderboard: Top contributors by week/month/all-time
- Reputation visible on profile and next to username in posts
- Anti-gaming measures: Downvote limit (20 per day), same user votes count once per day

---

### Epic 7: Platform Administration

#### Story 7.1: Admin Dashboard
**As a** community admin (Ana)
**I want to** view platform-wide analytics and health metrics
**So that** I can monitor community growth and identify issues

**Priority**: Must Have
**Complexity**: Large (13 story points)

**Acceptance Criteria**:
- Dashboard sections: Overview, Users, Content, Groups, Moderation, Engagement
- Overview metrics: Total users, Active users (DAU/MAU), New registrations, Posts/comments per day, Average engagement rate
- User metrics: User growth chart, Churn rate, Activation rate, User lifecycle stages, Top contributors
- Content metrics: Posts per day, Comment rate, Avg time to first comment, Most popular topics, Content type distribution
- Group metrics: Total groups, Active groups, Avg members per group, Group growth rate, Most active groups
- Moderation metrics: Reports per day, Avg resolution time, Top report reasons, Moderator activity
- Engagement metrics: Session duration, Pages per session, Bounce rate, Retention cohorts
- Data visualizations: Charts, graphs, heatmaps, trend lines
- Date range selector: Last 7 days, 30 days, 90 days, Custom range
- Export reports as PDF or CSV

---

#### Story 7.2: User Management
**As a** community admin (Ana)
**I want to** manage user accounts and permissions
**So that** I can handle support requests and security issues

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- Search users by: Name, Email, Username, User ID
- User details view: Profile, Activity history, Reports (sent/received), Warnings/bans
- Admin actions: Reset password, Verify email manually, Change role, Suspend account, Delete account
- Account status: Active, Suspended (temp/permanent), Deleted, Pending Verification
- User roles: Admin, Moderator, Verified User, Member, New Member
- Bulk user import/export (CSV)
- Impersonate user (for support debugging, logged and time-limited)
- User notes (private admin notes visible only to admins)

---

#### Story 7.3: Platform Configuration
**As a** community admin (Ana)
**I want to** configure platform-wide settings
**So that** I can align the platform with organizational policies

**Priority**: Must Have
**Complexity**: Medium (5 story points)

**Acceptance Criteria**:
- General settings: Platform name, Logo, Favicon, Primary color, Timezone, Language (Serbian/English)
- Registration settings: Open/Closed/Invite-only, Email verification required, Min age, Terms acceptance
- Content policies: Max post length, Allowed file types, Max file sizes, NSFW content allowed (yes/no)
- Moderation settings: Auto-flag keywords, Report threshold for auto-hide, Min account age for posting
- Email settings: SMTP configuration, Email templates, Sender name/address
- Security settings: Password requirements, Session timeout, 2FA required for admins, Rate limiting
- Integration settings: OAuth providers (Google/GitHub), Analytics (Google Analytics, Plausible), CDN configuration
- Feature flags: Enable/disable features in beta (e.g., polls, live chat, video calls)

---

#### Story 7.4: Announcement System
**As a** community admin (Ana)
**I want to** create platform-wide announcements
**So that** I can communicate important information to all users

**Priority**: Should Have
**Complexity**: Small (3 story points)

**Acceptance Criteria**:
- Announcement types: Banner (top of page), Modal (on login), In-feed post, Email blast
- Announcement content: Title, Body (rich text), CTA button (optional), Dismissible (yes/no)
- Target audience: All users, Specific groups, User roles, New users only
- Scheduling: Publish immediately or schedule for future date/time
- Expiration: Set end date for time-sensitive announcements
- Analytics: View count, Click-through rate, Dismissal rate
- Announcement history: List of past announcements with performance metrics

---

## User Journey Maps

### Journey 1: New User Registration and First Post

**Persona**: Nina (New Member)
**Goal**: Join the community and make a first contribution
**Duration**: 15-20 minutes
**Success Criteria**: Complete registration, join 2+ groups, create first post

#### Journey Stages:

**Stage 1: Discovery (Pre-Platform)**
- **Trigger**: Colleague mentions Serbian Agentics Foundation community
- **Touchpoints**: Word of mouth, Google search, LinkedIn post
- **Actions**: Searches for platform, reads about community
- **Thoughts**: "Is this for beginners like me?"
- **Emotions**: Curious 😊, Uncertain 🤔
- **Pain Points**: Unsure if the community is welcoming to juniors

**Stage 2: Registration**
- **Touchpoints**: Landing page, Registration form
- **Actions**: Clicks "Join Now", fills email/password, accepts terms
- **Thoughts**: "I hope this doesn't require too much personal info"
- **Emotions**: Cautiously optimistic 🙂
- **Pain Points**: Privacy concerns, long forms
- **Platform Response**: Simple form (3 fields), social login option, clear privacy statement

**Stage 3: Onboarding - Interest Selection**
- **Touchpoints**: Interest selection screen
- **Actions**: Selects 4 interests (AI Basics, Frontend Dev, Career Growth, Beginner Resources)
- **Thoughts**: "Good, they have beginner-friendly options"
- **Emotions**: Relieved 😌, Engaged 😊
- **Pain Points**: Overwhelmed by too many choices
- **Platform Response**: 18 interest options, categorized, "Beginner-friendly" tag

**Stage 4: Onboarding - Group Recommendations**
- **Touchpoints**: Group recommendation screen
- **Actions**: Reviews 6 recommended groups, joins "AI for Beginners" and "Serbian Tech Community"
- **Thoughts**: "These look perfect for my level!"
- **Emotions**: Excited 😃, Confident 💪
- **Pain Points**: Unsure which groups are active
- **Platform Response**: Shows member count, recent activity badge, clear descriptions

**Stage 5: Onboarding - Welcome Tour**
- **Touchpoints**: Interactive product tour (5 steps)
- **Actions**: Completes tour, learns about feed, posting, notifications
- **Thoughts**: "Okay, I think I understand how this works"
- **Emotions**: Confident 💪, Ready 🚀
- **Pain Points**: Tour too long or interrupting exploration
- **Platform Response**: Skippable, 5 quick steps with visuals, can replay later

**Stage 6: Exploration - Feed Browsing**
- **Touchpoints**: Home feed
- **Actions**: Scrolls through feed, reads 3 posts about AI basics, bookmarks 1 tutorial
- **Thoughts**: "This content is actually really helpful!"
- **Emotions**: Delighted 😍, Inspired 💡
- **Pain Points**: Too much content, hard to find beginner material
- **Platform Response**: Personalized feed based on interests, "Beginner" tag on posts

**Stage 7: First Contribution - Asking a Question**
- **Touchpoints**: Post creation interface
- **Actions**: Clicks "Create Post", writes question about AI in web development, selects "AI for Beginners" group, adds "Question" and "Frontend" tags
- **Thoughts**: "I hope this isn't a dumb question..."
- **Emotions**: Nervous 😰, Vulnerable 😟
- **Pain Points**: Fear of judgment, imposter syndrome
- **Platform Response**: Supportive UI copy ("All questions are welcome!"), automatic "Beginner" tag suggestion

**Stage 8: First Contribution - Publishing**
- **Touchpoints**: Post preview, publish confirmation
- **Actions**: Reviews post, clicks "Publish"
- **Thoughts**: "Okay, I did it!"
- **Emotions**: Accomplished 🎉, Anxious 😬 (waiting for response)
- **Pain Points**: Anxiety about negative reactions
- **Platform Response**: Encouragement message ("Great first post!"), notification when someone responds

**Stage 9: First Engagement - Receiving Response**
- **Touchpoints**: Notification, comment on post
- **Actions**: Receives helpful comment within 30 minutes, replies with thanks
- **Thoughts**: "Wow, people here are really friendly!"
- **Emotions**: Relieved 😌, Grateful 🙏, Welcomed 🤗
- **Pain Points**: No response = feeling ignored
- **Platform Response**: Auto-prompt active members to answer beginner questions, "First Post" badge on Nina's question

**Stage 10: Continued Engagement**
- **Touchpoints**: Mobile app, daily digest email
- **Actions**: Checks app next day, reads 2 more responses, marks one as "Helpful answer"
- **Thoughts**: "I want to help others like people helped me"
- **Emotions**: Motivated 💪, Belonging 🏡
- **Pain Points**: Forgetting to check back
- **Platform Response**: Email notification when post gets activity, daily digest of relevant content

---

### Journey 2: Content Creator Publishing Tutorial

**Persona**: Jelena (Content Creator)
**Goal**: Share comprehensive tutorial on NLP topic
**Duration**: 2-3 hours (creation) + ongoing (engagement)
**Success Criteria**: Publish high-quality tutorial, receive engagement, answer questions

#### Journey Stages:

**Stage 1: Inspiration**
- **Trigger**: Solves interesting NLP problem at work, wants to share learnings
- **Touchpoints**: Personal notes, research papers
- **Actions**: Decides to write tutorial for community
- **Thoughts**: "This could really help others avoid the mistakes I made"
- **Emotions**: Excited 😃, Motivated 💪
- **Pain Points**: Finding time to write quality content

**Stage 2: Content Preparation**
- **Touchpoints**: Local text editor, code examples, diagrams
- **Actions**: Writes 3,000-word tutorial, prepares 5 code snippets, creates 2 diagrams
- **Thoughts**: "I hope the platform supports code formatting well"
- **Emotions**: Focused 🎯, Creative 🎨
- **Pain Points**: Time-consuming, needs good formatting tools

**Stage 3: Platform Entry**
- **Touchpoints**: Desktop browser, platform homepage
- **Actions**: Logs in, navigates to "Create Post"
- **Thoughts**: "Let's see if this editor is any good"
- **Emotions**: Hopeful 🤞, Prepared 📝
- **Pain Points**: Complex or unintuitive post creation

**Stage 4: Content Drafting**
- **Touchpoints**: Rich text editor
- **Actions**: Pastes tutorial, applies Markdown formatting, adds headers, inserts code blocks with syntax highlighting
- **Thoughts**: "Great! The editor supports Markdown and code highlighting"
- **Emotions**: Satisfied 😊, Productive 💼
- **Pain Points**: Editor limitations, losing work to crashes
- **Platform Response**: Auto-save every 30 seconds, Markdown + WYSIWYG toggle, syntax highlighting for Python/JavaScript/etc.

**Stage 5: Adding Media**
- **Touchpoints**: Media upload interface
- **Actions**: Uploads 2 diagram images, 1 example output screenshot
- **Thoughts**: "Need to add alt text for accessibility"
- **Emotions**: Professional 👩‍💼, Considerate 💭
- **Pain Points**: Slow uploads, no alt text option
- **Platform Response**: Drag-and-drop upload, progress bar, alt text field, image preview

**Stage 6: Metadata and Tagging**
- **Touchpoints**: Post metadata form
- **Actions**: Selects "NLP Serbia" group, adds tags (NLP, Tutorial, Python, BERT), sets visibility to Public, adds custom thumbnail
- **Thoughts**: "Tags will help people find this later"
- **Emotions**: Strategic 🎯, Thorough ✅
- **Pain Points**: Limited tag suggestions, unclear visibility options
- **Platform Response**: Auto-suggest popular tags, clear visibility descriptions, custom thumbnail upload

**Stage 7: Preview and Refinement**
- **Touchpoints**: Post preview mode
- **Actions**: Reviews post in preview, fixes formatting issues, checks code readability on mobile
- **Thoughts**: "Looks good on both desktop and mobile"
- **Emotions**: Perfectionist 🎨, Proud 😌
- **Pain Points**: Preview doesn't match published version
- **Platform Response**: Accurate preview, mobile/desktop toggle, accessibility checker

**Stage 8: Publishing**
- **Touchpoints**: Publish button, confirmation
- **Actions**: Clicks "Publish", shares link on LinkedIn
- **Thoughts**: "I hope people find this useful"
- **Emotions**: Accomplished 🎉, Anxious 😬 (waiting for feedback)
- **Pain Points**: No immediate validation
- **Platform Response**: Confirmation message, shareable link, auto-post to group feed

**Stage 9: Initial Engagement (First Hour)**
- **Touchpoints**: Notification center, mobile app
- **Actions**: Receives 5 reactions (👍💡❤️), 2 comments asking questions, responds to both
- **Thoughts**: "Great questions! This is exactly the engagement I wanted"
- **Emotions**: Validated 😊, Engaged 💬, Valued 🌟
- **Pain Points**: Overwhelming notifications, missing important comments
- **Platform Response**: Smart notifications (grouped by post), highlights questions vs. general comments

**Stage 10: Ongoing Engagement (First Week)**
- **Touchpoints**: Email digest, mobile app, desktop
- **Actions**: Tutorial receives 50 reactions, 15 comments, 12 bookmarks. Jelena responds to 10 comments, updates post with FAQ section
- **Thoughts**: "This is helping people! Maybe I should write more tutorials"
- **Emotions**: Fulfilled 😊, Motivated 💪, Appreciated 🙏
- **Pain Points**: Time-consuming to respond to every comment
- **Platform Response**: Daily engagement digest email, comment sorting (questions first), "Edit post" option, engagement analytics

**Stage 11: Content Performance Analysis**
- **Touchpoints**: Creator dashboard (analytics)
- **Actions**: Reviews tutorial performance: 300 views, 50 reactions, 18% engagement rate, 12 bookmarks, 3 shares
- **Thoughts**: "Good engagement! The 'BERT' tag drove most traffic"
- **Emotions**: Data-driven 📊, Strategic 🎯, Satisfied 😊
- **Pain Points**: Lack of detailed analytics
- **Platform Response**: Detailed analytics: views over time, traffic sources, top tags, audience demographics, export data

**Stage 12: Long-term Impact (30 Days)**
- **Touchpoints**: Notification, profile page
- **Actions**: Tutorial still getting views and comments. Jelena receives 50 reputation points, unlocks "Top Contributor" badge. 2 people DM her for collaboration
- **Thoughts**: "This platform is really helping me build my professional network"
- **Emotions**: Grateful 🙏, Proud 😌, Connected 🤝
- **Pain Points**: Hard to track long-term content performance
- **Platform Response**: Monthly content summary email, badges visible on profile, DM system for networking

---

### Journey 3: Group Leader Moderating Content

**Persona**: Stefan (Group Leader/Moderator)
**Goal**: Review and moderate flagged content, maintain group quality
**Duration**: 30-45 minutes daily
**Success Criteria**: Clear moderation queue, maintain community health, support members

#### Journey Stages:

**Stage 1: Daily Check-in**
- **Trigger**: Morning routine, 8 AM
- **Touchpoints**: Mobile app notification
- **Actions**: Receives notification: "5 items in moderation queue"
- **Thoughts**: "Let me quickly review these before work"
- **Emotions**: Responsible 💼, Focused 🎯
- **Pain Points**: Too many notifications, unclear urgency

**Stage 2: Accessing Moderation Queue**
- **Touchpoints**: Mobile app, moderation dashboard
- **Actions**: Opens app, navigates to mod queue, views 5 flagged items
- **Thoughts**: "Okay, 3 spam posts and 2 reported comments"
- **Emotions**: Alert 👀, Professional 👨‍💼
- **Pain Points**: Hard to prioritize what needs immediate attention
- **Platform Response**: Queue items sorted by severity (High/Medium/Low), color-coded

**Stage 3: Reviewing Flagged Content - Item 1 (Spam Post)**
- **Touchpoints**: Moderation interface
- **Actions**: Reviews post (promotional link with no context), checks author history (new account, 0 contributions), sees AI confidence score: 95% spam
- **Thoughts**: "Clear spam, easy decision"
- **Emotions**: Confident 💪, Efficient ⚡
- **Pain Points**: Having to check author history manually
- **Platform Response**: All context in one view: content, author summary, AI assessment, report details

**Stage 4: Taking Action - Removal**
- **Touchpoints**: Action menu
- **Actions**: Selects "Remove + Ban User (Permanent)", selects reason "Spam", adds note "Promotional link, new account"
- **Thoughts**: "Done. Next."
- **Emotions**: Decisive ✅, Moving on ➡️
- **Pain Points**: Too many clicks to complete action
- **Platform Response**: One-click quick actions for common scenarios, bulk actions available

**Stage 5: Reviewing Flagged Content - Item 2 (Borderline Case)**
- **Touchpoints**: Moderation interface
- **Actions**: Reviews reported comment (user disagreement that became heated), checks context (full comment thread), reviews community guidelines
- **Thoughts**: "This is borderline. Not hate speech, but unnecessarily aggressive"
- **Emotions**: Thoughtful 🤔, Careful ⚖️, Conflicted 😕
- **Pain Points**: Difficult edge cases, fear of making wrong decision
- **Platform Response**: Full thread context, similar past decisions shown, option to consult with co-mods

**Stage 6: Taking Action - Warning**
- **Touchpoints**: Action menu
- **Actions**: Selects "Approve with Warning", sends warning message: "Please keep discussions respectful per our guidelines", leaves comment visible
- **Thoughts**: "Hopefully this corrects behavior without being too harsh"
- **Emotions**: Fair ⚖️, Educational 📚, Hopeful 🤞
- **Pain Points**: No template for warning messages
- **Platform Response**: Warning templates available, option to customize, warning tracked in user history

**Stage 7: Clearing Remaining Queue**
- **Touchpoints**: Moderation dashboard
- **Actions**: Reviews and actions remaining 3 items (2 spam removals, 1 false report dismissal) in 5 minutes
- **Thoughts**: "Queue cleared, group is clean"
- **Emotions**: Accomplished ✅, Efficient ⚡, Satisfied 😊
- **Pain Points**: Repetitive clicks for similar actions
- **Platform Response**: Bulk actions: Select multiple spam posts, apply same action

**Stage 8: Proactive Monitoring - Group Health**
- **Touchpoints**: Group analytics dashboard
- **Actions**: Checks group health metrics: 85% health score (good), 20 new members this week, 45 posts, 3 active discussions
- **Thoughts**: "Engagement is steady. Health score dropped 3 points due to 2 reports this week"
- **Emotions**: Analytical 📊, Strategic 🎯, Slightly concerned 😐
- **Pain Points**: Unclear what caused health score drop
- **Platform Response**: Health score breakdown: engagement (+), reports (-), member growth (+), detailed insights

**Stage 9: Member Engagement - Welcoming New Members**
- **Touchpoints**: New member list
- **Actions**: Reviews 5 new members who joined today, sends personalized welcome DM to each
- **Thoughts**: "Making them feel welcome will increase retention"
- **Emotions**: Welcoming 🤗, Nurturing 🌱, Community-focused 🏡
- **Pain Points**: Time-consuming to message each person individually
- **Platform Response**: Welcome message template with personalization tokens (name, interests), option to auto-send

**Stage 10: Proactive Content - Creating Discussion Prompt**
- **Touchpoints**: Post creation
- **Actions**: Creates weekly discussion prompt: "What AI project are you working on this week?", pins to top of group
- **Thoughts**: "This should spark some good discussions"
- **Emotions**: Creative 🎨, Proactive 🚀, Excited 😃
- **Pain Points**: Forgetting to create weekly prompts
- **Platform Response**: Recurring post scheduler, template library, auto-pin option

**Stage 11: Coordination with Co-Mods**
- **Touchpoints**: Mod chat / DM
- **Actions**: Sends message to co-mod about the borderline case from earlier, asks for second opinion
- **Thoughts**: "Good to get another perspective on tough calls"
- **Emotions**: Collaborative 🤝, Humble 🙏, Responsible 💼
- **Pain Points**: No dedicated mod communication channel
- **Platform Response**: Private mod chat for each group, mod-only notes on content

**Stage 12: Evening Check - Following Up**
- **Touchpoints**: Mobile app, evening
- **Actions**: Checks moderation queue again (2 new items), reviews earlier warning (user thanked him for feedback), responds to mod chat
- **Thoughts**: "Good, the warning was received well. Queue is manageable"
- **Emotions**: Relieved 😌, Positive 🙂, Responsible 💼
- **Pain Points**: Constant vigilance required
- **Platform Response**: Smart notifications (only urgent items in evening), daily summary email option

---

### Journey 4: Community Admin Planning Campaign

**Persona**: Ana (Community Admin)
**Goal**: Plan and execute community engagement campaign
**Duration**: 2 weeks (planning) + 1 month (execution)
**Success Criteria**: Increase active users by 20%, improve retention, boost engagement

#### Journey Stages:

**Stage 1: Identifying Need**
- **Trigger**: Monthly analytics review shows 15% drop in active users
- **Touchpoints**: Admin dashboard, analytics reports
- **Actions**: Reviews metrics, identifies declining engagement trend
- **Thoughts**: "We need a campaign to re-engage dormant users"
- **Emotions**: Concerned 😟, Determined 💪, Strategic 🎯
- **Pain Points**: Lack of real-time alerts for declining metrics

**Stage 2: Data Analysis**
- **Touchpoints**: User segmentation tools, cohort analysis
- **Actions**: Segments users by activity level, identifies 200 "at-risk" users (haven't logged in 30+ days), analyzes common characteristics
- **Thoughts**: "Most at-risk users joined groups but never posted. Onboarding issue?"
- **Emotions**: Analytical 📊, Insightful 💡, Focused 🎯
- **Pain Points**: Manual data analysis, no predictive churn model
- **Platform Response**: User segmentation filters, churn risk scores, cohort analysis tool

**Stage 3: Campaign Planning**
- **Touchpoints**: Campaign planning spreadsheet, team meetings
- **Actions**: Plans "30-Day Engagement Challenge" campaign with weekly themes, prizes for top contributors, special badges
- **Thoughts**: "Gamification + community recognition should drive engagement"
- **Emotions**: Creative 🎨, Excited 😃, Hopeful 🤞
- **Pain Points**: No campaign management tools in platform
- **Platform Response**: Campaign planning module (in future), integration with external tools

**Stage 4: Stakeholder Alignment**
- **Touchpoints**: Email, video call with Foundation leadership
- **Actions**: Presents campaign plan to Foundation leadership, gets approval and budget (€500 for prizes)
- **Thoughts**: "Great, we have buy-in and resources"
- **Emotions**: Supported 🙌, Empowered 💪, Professional 👩‍💼
- **Pain Points**: Manual reporting to stakeholders
- **Platform Response**: Executive summary reports (exportable), stakeholder dashboard access

**Stage 5: Moderator Coordination**
- **Touchpoints**: Mod chat, group DM with all group leaders
- **Actions**: Briefs 8 group leaders on campaign, assigns roles (each leader creates 1 weekly challenge for their group)
- **Thoughts**: "Getting group leaders involved will make this feel community-driven, not top-down"
- **Emotions**: Collaborative 🤝, Empowering 💪, Organized 📋
- **Pain Points**: Difficult to track who agreed to do what
- **Platform Response**: Task assignment tool for mods, campaign collaboration space

**Stage 6: Campaign Launch - Announcement**
- **Touchpoints**: Platform-wide banner, email blast, in-feed announcement post
- **Actions**: Creates announcement post, enables banner ("Join our 30-Day Challenge!"), schedules email to all users
- **Thoughts**: "Let's make this visible everywhere"
- **Emotions**: Excited 😃, Nervous 😬 (will it work?), Hopeful 🤞
- **Pain Points**: Announcement tools spread across different interfaces
- **Platform Response**: Unified announcement system (banner + email + post from one form)

**Stage 7: Week 1 - Monitoring Initial Response**
- **Touchpoints**: Campaign dashboard (custom), daily analytics
- **Actions**: Tracks participation: 45 users joined challenge (22% of target), 12 at-risk users reactivated, 120 posts with #30DayChallenge tag
- **Thoughts**: "Decent start, but need to push harder to hit goal"
- **Emotions**: Cautiously optimistic 🙂, Analytical 📊, Action-oriented 🚀
- **Pain Points**: No real-time campaign tracking
- **Platform Response**: Campaign dashboard showing real-time participation, goal progress, engagement metrics

**Stage 8: Course Correction - Boosting Participation**
- **Touchpoints**: Social media, email, in-app prompts
- **Actions**: Increases promotion: LinkedIn/Twitter posts, reminder email to non-participants, prompts low-activity users on login
- **Thoughts**: "Need to reach people where they are, not just in-platform"
- **Emotions**: Adaptive 🔄, Persistent 💪, Multi-channel 📢
- **Pain Points**: Manual cross-platform posting
- **Platform Response**: Social media integration for sharing, automated reminder emails based on user activity

**Stage 9: Mid-Campaign - Celebrating Wins**
- **Touchpoints**: Platform announcement, group shoutouts
- **Actions**: Highlights top contributors, shares success stories, awards mid-campaign badges ("Week 2 Champion")
- **Thoughts**: "Recognition will motivate continued participation"
- **Emotions**: Celebratory 🎉, Encouraging 🙌, Community-focused 🏡
- **Pain Points**: Manual badge assignment
- **Platform Response**: Auto-award badges based on campaign rules, highlight reel generation

**Stage 10: Week 4 - Campaign Conclusion**
- **Touchpoints**: Final announcement, prize distribution, thank-you emails
- **Actions**: Announces campaign results (180 participants, 60 at-risk users reactivated), awards prizes, sends thank-you emails with next steps
- **Thoughts**: "Success! But need to maintain momentum"
- **Emotions**: Accomplished 🎉, Grateful 🙏, Forward-thinking 🔮
- **Pain Points**: Prize fulfillment logistics
- **Platform Response**: Prize fulfillment tracking, automated thank-you messages

**Stage 11: Post-Campaign Analysis**
- **Touchpoints**: Analytics dashboard, campaign report
- **Actions**: Analyzes results: 22% increase in active users (exceeded goal!), 30% retention improvement, 150% increase in posts during campaign
- **Thoughts**: "What worked? Weekly themes and group leader involvement were key"
- **Emotions**: Proud 😊, Analytical 📊, Learning 📚
- **Pain Points**: Manual data collection from multiple sources
- **Platform Response**: Automated campaign report with before/after metrics, success factors analysis

**Stage 12: Stakeholder Reporting**
- **Touchpoints**: Presentation to Foundation leadership
- **Actions**: Presents campaign results, ROI calculation (€500 investment -> 60 reactivated users = €8.33 per reactivation), recommends quarterly campaigns
- **Thoughts**: "Data shows clear impact. They'll approve more campaigns"
- **Emotions**: Confident 💪, Professional 👩‍💼, Strategic 🎯
- **Pain Points**: Time-consuming report preparation
- **Platform Response**: Executive report generator (PDF export with charts), ROI calculator

---

## Acceptance Criteria

### General Acceptance Criteria (All Stories)

**Functional Requirements**:
- Feature works as described in user story
- All edge cases handled gracefully
- Error messages are clear and actionable
- Feature accessible via keyboard navigation
- Feature works on latest Chrome, Firefox, Safari, Edge

**Performance Requirements**:
- Page load time < 3 seconds on 4G connection
- API response time < 500ms for 95% of requests
- Smooth animations (60 FPS)
- Optimistic UI updates where appropriate

**Security Requirements**:
- Input validation and sanitization
- XSS prevention
- CSRF protection
- Rate limiting on public endpoints
- Audit logging for sensitive actions

**Accessibility Requirements (WCAG 2.1 AA)**:
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigable
- Screen reader compatible
- Color contrast ratio > 4.5:1
- Focus indicators visible

**Responsive Design**:
- Mobile-first approach
- Works on devices 320px - 2560px wide
- Touch-friendly targets (min 44x44px)
- Readable text without zooming (min 16px)

**Internationalization**:
- Serbian and English language support
- RTL layout support (for future languages)
- Date/time formatting respects user locale
- Number/currency formatting respects locale

---

### Specific Story Acceptance Criteria

**Story 1.1: Account Creation**
- ✅ User can register with email + password
- ✅ User can register with Google OAuth
- ✅ User can register with GitHub OAuth
- ✅ Email verification email sent within 30 seconds
- ✅ Password must meet strength requirements (8+ chars, 1 uppercase, 1 number)
- ✅ Real-time password strength indicator shown
- ✅ GDPR consent checkbox required
- ✅ Privacy policy linked and accessible
- ✅ Duplicate email shows clear error message
- ✅ Account creation completes in < 2 minutes
- ✅ User automatically logged in after successful registration
- ✅ Profile created with default avatar

**Story 1.2: Interest Selection**
- ✅ User shown 15-20 interest tags
- ✅ User must select minimum 3 interests
- ✅ User can select maximum 10 interests
- ✅ Selected interests have visual indicator (checkmark, color change)
- ✅ "Skip for now" button available
- ✅ Interest selections saved to user profile
- ✅ Interest selections used for feed personalization
- ✅ User can update interests later in profile settings
- ✅ Mobile: Interest tags are touch-friendly (min 44px height)

**Story 2.1: Personalized Feed**
- ✅ Feed shows posts from user's joined groups
- ✅ Feed shows posts from user's followed topics
- ✅ Feed shows posts from users they follow
- ✅ Default sort: Relevance (personalized algorithm)
- ✅ Sort options: Recent, Popular (24h/7d/30d)
- ✅ Infinite scroll loads 20 posts per page
- ✅ Each post preview shows: author, timestamp, group, content snippet, engagement metrics
- ✅ "Mute" option available on each post
- ✅ Pull-to-refresh on mobile
- ✅ Empty state shows group/topic recommendations
- ✅ Feed loads in < 2 seconds on 4G connection
- ✅ Loading skeleton shown while fetching posts

**Story 3.1: Create Text Post**
- ✅ Rich text editor with formatting toolbar
- ✅ Toolbar includes: Bold, Italic, Headers (H1-H3), Lists (ordered/unordered), Blockquote, Code block
- ✅ Code syntax highlighting for 20+ languages
- ✅ Markdown mode toggle available
- ✅ Inline image upload (drag-and-drop or file picker)
- ✅ Link preview auto-generation
- ✅ Character limit: 50,000 characters
- ✅ Character count shown with limit warning at 90%
- ✅ Auto-save drafts every 30 seconds
- ✅ Draft recovery on page refresh
- ✅ Post visibility options: Public, Group Only, Followers Only
- ✅ Topic tags required (min 1, max 5)
- ✅ Topic tag autocomplete suggestions
- ✅ Post preview before publishing
- ✅ Mobile: Simplified editor with essential formatting only

**Story 4.2: Moderate Content**
- ✅ Moderation queue shows reported content
- ✅ Moderation queue shows AI-flagged content
- ✅ Moderation queue shows pending approval items (closed groups)
- ✅ Each queue item shows: content, author, reporter/reason, timestamp
- ✅ Queue sorted by priority (severity) and date
- ✅ Moderator actions: Approve, Remove, Remove + Warn, Remove + Ban (temp/permanent)
- ✅ Bulk action mode: Select multiple items, apply same action
- ✅ Removal requires reason selection
- ✅ Removal reasons: Spam, Harassment, Off-topic, Misinformation, Hate Speech, Other (custom text)
- ✅ Removed content visible to mods with strike-through (audit trail)
- ✅ Action log records: action, moderator, timestamp, reason
- ✅ Auto-remove content after 3 reports (pending mod review)
- ✅ Notification sent to content author on removal
- ✅ Mobile: Essential moderation actions available

**Story 7.1: Admin Dashboard**
- ✅ Dashboard sections: Overview, Users, Content, Groups, Moderation, Engagement
- ✅ Overview: Total users, DAU/MAU, New registrations (daily), Posts/comments per day, Avg engagement rate
- ✅ User metrics: User growth chart (line), Churn rate, Activation rate, User lifecycle stages, Top contributors
- ✅ Content metrics: Posts per day (bar chart), Comment rate, Avg time to first comment, Popular topics (tag cloud), Content type distribution (pie)
- ✅ Group metrics: Total groups, Active groups, Avg members per group, Group growth rate, Most active groups (table)
- ✅ Moderation metrics: Reports per day, Avg resolution time, Top report reasons, Moderator activity
- ✅ Engagement metrics: Session duration, Pages per session, Bounce rate, Retention cohorts (heatmap)
- ✅ Date range selector: Last 7d / 30d / 90d / Custom range
- ✅ All charts interactive (hover for details, click for drill-down)
- ✅ Export reports as PDF or CSV
- ✅ Dashboard loads in < 3 seconds
- ✅ Real-time data refresh every 5 minutes (or manual refresh)

---

## MoSCoW Prioritization

### Must Have (MVP Launch Blockers)

**User Authentication & Onboarding**:
- ✅ Story 1.1: Account Creation (Email/Password + OAuth)
- ✅ Story 1.2: Interest Selection
- ✅ Story 1.3: Group Recommendations

**Content Discovery**:
- ✅ Story 2.1: Personalized Feed
- ✅ Story 2.2: Topic Filtering
- ✅ Story 2.4: Search Functionality

**Content Creation**:
- ✅ Story 3.1: Create Text Post
- ✅ Story 3.2: Add Media to Posts
- ✅ Story 3.3: Comment on Posts

**Group Management**:
- ✅ Story 4.1: Create New Group
- ✅ Story 4.2: Moderate Content
- ✅ Story 4.3: Manage Members

**Notifications**:
- ✅ Story 5.1: In-App Notifications

**User Profile**:
- ✅ Story 6.1: View User Profile
- ✅ Story 6.2: Edit Own Profile

**Platform Administration**:
- ✅ Story 7.1: Admin Dashboard
- ✅ Story 7.2: User Management
- ✅ Story 7.3: Platform Configuration

**Total Must Have Stories**: 16

---

### Should Have (Post-MVP, High Priority)

**Onboarding**:
- 🟡 Story 1.4: Welcome Tour

**Content Discovery**:
- 🟡 Story 2.3: Bookmarking Content

**Content Engagement**:
- 🟡 Story 3.4: React to Content
- 🟡 Story 3.5: Share Content

**Group Management**:
- 🟡 Story 4.4: Configure Group Settings

**Notifications**:
- 🟡 Story 5.2: Email Notifications

**User Profile**:
- 🟡 Story 6.3: Reputation System

**Platform Administration**:
- 🟡 Story 7.4: Announcement System

**Total Should Have Stories**: 8

---

### Could Have (Nice to Have, Lower Priority)

**Notifications**:
- 🔵 Story 5.3: Push Notifications (PWA)

**Advanced Features** (Not in current stories):
- 🔵 Dark Mode
- 🔵 Polls in Posts
- 🔵 Live Chat / Direct Messaging
- 🔵 Event Management (Calendar integration)
- 🔵 Content Scheduling
- 🔵 Advanced Analytics (Heatmaps, User Flows)
- 🔵 Multi-language Content (Translation)
- 🔵 Video/Audio Recording in Posts
- 🔵 Collaborative Posts (Co-authors)

**Total Could Have Stories**: 10+

---

### Won't Have (Out of Scope for V1)

**Features Deferred to Future Releases**:
- ❌ Live Video Streaming
- ❌ E-commerce / Marketplace
- ❌ Custom Domain per Group
- ❌ White-label Solution
- ❌ Mobile Native Apps (iOS/Android)
- ❌ Blockchain/Web3 Integration
- ❌ AI Content Generation (beyond moderation)
- ❌ VR/AR Features
- ❌ Game Mechanics / Achievements (beyond basic badges)

---

## Validation Metrics

### Key Performance Indicators (KPIs)

**User Acquisition**:
- New user registrations per week: Target 50+ (Month 1), 100+ (Month 3)
- Registration completion rate: Target 80%+
- Organic vs. referred user ratio: Track for growth insights

**User Activation**:
- Activation rate (complete profile + first interaction within 7 days): Target 80%+
- Time to first post/comment: Target < 3 days median
- Groups joined per new user: Target 2+ average

**User Engagement**:
- Daily Active Users (DAU): Target 30% of total users
- Monthly Active Users (MAU): Target 60% of total users
- DAU/MAU ratio: Target 0.5+ (indicates strong daily habit)
- Average session duration: Target 15+ minutes
- Average interactions per active user per week: Target 3+ (posts + comments + reactions)
- Content engagement rate (likes + comments / views): Target 10%+

**User Retention**:
- Day 1 retention: Target 60%+
- Day 7 retention: Target 40%+
- Day 30 retention: Target 30%+
- Month 3 retention: Target 60%+
- Churn rate: Target < 10% monthly

**Content Quality**:
- Posts per day: Target 20+ (Month 1), 50+ (Month 3)
- Comments per post: Target 3+ average
- Spam/removed content rate: Target < 5% of total content
- Average time to first comment: Target < 2 hours
- Bookmark rate (bookmarks / views): Target 5%+

**Community Health**:
- Net Promoter Score (NPS): Target 50+
- User satisfaction score (CSAT): Target 4.5+ / 5
- Moderator response time: Target < 4 hours median
- Report resolution time: Target < 24 hours median
- Active groups: Target 80%+ of total groups have 1+ post per week

**Platform Performance**:
- Average page load time: Target < 2 seconds (4G)
- API response time (p95): Target < 500ms
- Error rate: Target < 0.5% of requests
- Uptime: Target 99.9%+

---

### User Journey Success Metrics

**New User Registration Journey**:
- Journey completion rate: Target 80%+
- Average completion time: Target < 5 minutes
- Drop-off points: Monitor each stage, optimize highest drop-offs
- User sentiment at completion: Target 4+ / 5

**First Post Journey**:
- % of new users who post within 7 days: Target 50%+
- Average time from registration to first post: Target < 3 days median
- First post engagement rate: Target 15%+ (vs. 10% average)
- First post receives response within 2 hours: Target 70%+

**Content Creator Journey**:
- % of posts receiving engagement within 1 hour: Target 80%+
- Creator retention rate (post again within 30 days): Target 70%+
- Average content performance (views, engagement): Track trends
- Creator satisfaction score: Target 4.5+ / 5

**Moderation Journey**:
- Moderator satisfaction score: Target 4+ / 5
- Average time spent on moderation per day: Monitor (target < 45 min)
- Moderation accuracy (correct decisions): Target 95%+
- Moderator burnout rate: Target < 10% quarterly

---

### Persona-Specific Success Metrics

**Marko (Community Member)**:
- Logs in 2-3 times per week: Track actual frequency
- Read-to-post ratio: Track (expect 80/20 per persona)
- Bookmark usage: Target 5+ bookmarks per month
- Responds to mentions: Target 80%+ response rate

**Jelena (Content Creator)**:
- Posts 2-3 articles per month: Track actual frequency
- Average engagement per post: Target 50+ interactions
- Response rate to comments: Target 70%+
- Content analytics usage: Target 80%+ of creators view analytics

**Stefan (Group Leader)**:
- Daily moderation queue clearance: Target 90%+ days
- Group health score: Target 80+ / 100
- Member onboarding: Target 70%+ new members receive welcome message
- Group engagement rate: Target 15%+ (vs. 10% platform average)

**Ana (Community Admin)**:
- Platform health score: Target 85+ / 100
- Campaign success rate: Target 80%+ campaigns achieve goals
- Stakeholder satisfaction: Target 4.5+ / 5
- Community growth rate: Target 20%+ per quarter

**Nina (New Member)**:
- Onboarding completion rate: Target 80%+
- Time to first interaction: Target < 3 days
- First-week engagement: Target 3+ interactions
- 30-day retention: Target 60%+

---

## Validation Testing Plan

### Usability Testing

**Method**: Moderated user testing sessions (5-8 participants per persona)

**Key Tasks**:
1. Complete registration and onboarding
2. Find and join relevant groups
3. Create first post
4. Discover and engage with content
5. Moderate content (for Stefan persona)
6. Review analytics dashboard (for Ana persona)

**Success Criteria**:
- Task completion rate: 80%+
- Task completion time: Within expected range
- User satisfaction: 4+ / 5
- Critical usability issues: 0
- Major usability issues: < 3

---

### A/B Testing Plan

**Onboarding Flow**:
- Variant A: Current 3-step onboarding
- Variant B: 5-step onboarding with welcome tour
- Metric: Activation rate
- Target: 5% improvement

**Feed Algorithm**:
- Variant A: Chronological feed
- Variant B: Personalized relevance algorithm
- Metric: Session duration, engagement rate
- Target: 10% improvement

**Post Editor**:
- Variant A: WYSIWYG only
- Variant B: WYSIWYG + Markdown toggle
- Metric: Post completion rate, creator satisfaction
- Target: No decrease in completion, 10% increase in satisfaction

---

### Accessibility Audit

**Method**: WCAG 2.1 AA compliance audit

**Tools**:
- Automated: axe DevTools, WAVE, Lighthouse
- Manual: Screen reader testing (NVDA, JAWS, VoiceOver)
- Keyboard navigation testing

**Success Criteria**:
- Zero Level A violations
- Zero Level AA violations
- Keyboard navigable: All interactive elements
- Screen reader compatible: All content and functionality

---

## Appendix

### User Story Format Template

```
**As a** [persona]
**I want to** [action]
**So that** [benefit]

**Priority**: [Must Have | Should Have | Could Have | Won't Have]
**Complexity**: [Small (1-3) | Medium (5) | Large (8-13) story points]

**Acceptance Criteria**:
- ✅ [Specific, testable criterion]
- ✅ [Specific, testable criterion]
- ...
```

---

### Persona Summary Table

| Persona | Age | Role | Tech Level | Primary Goal | Key Pain Point | Usage Pattern |
|---------|-----|------|------------|--------------|----------------|---------------|
| **Marko** | 28 | Community Member | High | Learn about AI | Information overload | 2-3x/week, mobile, lurking |
| **Jelena** | 32 | Content Creator | Expert | Share knowledge | Time-consuming formatting | Daily, desktop + mobile, active |
| **Stefan** | 35 | Group Leader | Expert | Build healthy community | Manual moderation | Daily, 60-90min, both devices |
| **Ana** | 29 | Community Admin | Intermediate-High | Grow platform | Lack of insights | Business hours, desktop primary |
| **Nina** | 24 | New Member | Intermediate | Learn & belong | Fear of judgment | Lunch + evening, mobile |

---

### User Journey Summary Table

| Journey | Persona | Duration | Key Touchpoints | Success Metric | Critical Pain Points |
|---------|---------|----------|----------------|----------------|---------------------|
| **Registration & First Post** | Nina | 15-20 min | Landing, Registration, Onboarding, Feed, Post Creation | 80% activation rate | Privacy concerns, fear of judgment |
| **Publishing Tutorial** | Jelena | 2-3 hours | Editor, Media Upload, Analytics | 50+ engagements | Time-consuming, formatting |
| **Moderating Content** | Stefan | 30-45 min daily | Mod Queue, Actions, Analytics | 90%+ queue clearance | Difficult edge cases, time |
| **Planning Campaign** | Ana | 2 weeks + 1 month | Analytics, Planning, Coordination, Execution | 20% growth | Lack of campaign tools |

---

### Story Dependencies

**Critical Path (MVP)**:
1. Account Creation (1.1) → Interest Selection (1.2) → Group Recommendations (1.3)
2. Create Text Post (3.1) → Add Media (3.2) → Comment on Posts (3.3)
3. Personalized Feed (2.1) → Topic Filtering (2.2) → Search (2.4)
4. Create Group (4.1) → Moderate Content (4.2) → Manage Members (4.3)
5. User Profile (6.1, 6.2) → Notifications (5.1)
6. Admin Dashboard (7.1) → User Management (7.2) → Platform Config (7.3)

**Enhancement Path (Post-MVP)**:
1. Welcome Tour (1.4) - Depends on: Basic onboarding complete
2. Bookmarking (2.3) - Depends on: Feed working
3. Reactions (3.4) - Depends on: Commenting working
4. Reputation System (6.3) - Depends on: Engagement tracking in place
5. Email Notifications (5.2) - Depends on: In-app notifications working

---

**Document Status**: ✅ Complete - Ready for Review
**Next Steps**:
1. Review with stakeholders (Serbian Agentics Foundation + StartIT)
2. Validate personas with real users (interviews)
3. Prioritize stories for Sprint 1 (MVP)
4. Technical architecture design based on requirements
5. Design mockups for key journeys

---

**End of User Personas and Stories Specification**
