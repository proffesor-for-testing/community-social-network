/**
 * Integration Event Routing Configuration
 *
 * Defines which domain events should be promoted to integration events
 * and published to Bull queues for cross-context async communication.
 *
 * Each route maps a domain event type to a Bull queue topic name.
 * When a use case persists an aggregate, domain events are collected,
 * and any matching route causes the event to be published as an
 * integration event on the specified queue.
 */

/**
 * A single routing rule: domain event type -> Bull queue topic.
 */
export interface IntegrationEventRoute {
  /** The domain eventType string (e.g., 'MemberRegistered'). */
  domainEventType: string;
  /** The Bull queue name this event should be published to. */
  queueName: string;
  /** Human-readable description of why this cross-context routing exists. */
  description: string;
}

// ---------------------------------------------------------------------------
// Queue topic constants
// ---------------------------------------------------------------------------

export const QUEUE_TOPICS = {
  /** Events that trigger notifications / alerts for users. */
  NOTIFICATION_TRIGGERS: 'notification-triggers',
  /** Events that should be logged in the admin audit trail. */
  AUDIT_LOG: 'audit-log',
  /** Events that require automatic profile lifecycle actions. */
  PROFILE_LIFECYCLE: 'profile-lifecycle',
  /** Events that require content feed filtering adjustments. */
  CONTENT_FILTER: 'content-filter',
} as const;

// ---------------------------------------------------------------------------
// Routing table
// ---------------------------------------------------------------------------

export const INTEGRATION_EVENT_ROUTES: IntegrationEventRoute[] = [
  // -----------------------------------------------------------------------
  // Notification triggers (Content -> Notification, Social -> Notification)
  // -----------------------------------------------------------------------
  {
    domainEventType: 'PublicationCreated',
    queueName: QUEUE_TOPICS.NOTIFICATION_TRIGGERS,
    description:
      'Notify followers when a member publishes new content.',
  },
  {
    domainEventType: 'DiscussionCreated',
    queueName: QUEUE_TOPICS.NOTIFICATION_TRIGGERS,
    description:
      'Notify the publication author when someone comments.',
  },
  {
    domainEventType: 'ReactionAdded',
    queueName: QUEUE_TOPICS.NOTIFICATION_TRIGGERS,
    description:
      'Notify the content author when a reaction is added.',
  },
  {
    domainEventType: 'FollowRequested',
    queueName: QUEUE_TOPICS.NOTIFICATION_TRIGGERS,
    description:
      'Notify a member when someone sends a follow request.',
  },
  {
    domainEventType: 'MemberMentioned',
    queueName: QUEUE_TOPICS.NOTIFICATION_TRIGGERS,
    description:
      'Notify a member when they are mentioned in content.',
  },

  // -----------------------------------------------------------------------
  // Audit log (Identity -> Admin, Admin -> Admin)
  // -----------------------------------------------------------------------
  {
    domainEventType: 'MemberSuspended',
    queueName: QUEUE_TOPICS.AUDIT_LOG,
    description:
      'Record an audit entry when an admin suspends a member.',
  },
  {
    domainEventType: 'MemberLocked',
    queueName: QUEUE_TOPICS.AUDIT_LOG,
    description:
      'Record an audit entry when a member account is locked.',
  },
  {
    domainEventType: 'SecurityAlertRaised',
    queueName: QUEUE_TOPICS.AUDIT_LOG,
    description:
      'Record an audit entry for security-related alerts.',
  },

  // -----------------------------------------------------------------------
  // Profile lifecycle (Identity -> Profile)
  // -----------------------------------------------------------------------
  {
    domainEventType: 'MemberRegistered',
    queueName: QUEUE_TOPICS.PROFILE_LIFECYCLE,
    description:
      'Auto-create a Profile when a new Member registers.',
  },

  // -----------------------------------------------------------------------
  // Content filter (Social Graph -> Content)
  // -----------------------------------------------------------------------
  {
    domainEventType: 'MemberBlocked',
    queueName: QUEUE_TOPICS.CONTENT_FILTER,
    description:
      'Filter blocked member content from the blocker feed.',
  },
  {
    domainEventType: 'MemberUnblocked',
    queueName: QUEUE_TOPICS.CONTENT_FILTER,
    description:
      'Restore previously-blocked member content in the feed.',
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Build a Map<domainEventType, queueName[]> for fast O(1) routing lookups.
 */
export function buildRoutingMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const route of INTEGRATION_EVENT_ROUTES) {
    const existing = map.get(route.domainEventType) ?? [];
    existing.push(route.queueName);
    map.set(route.domainEventType, existing);
  }
  return map;
}

/**
 * Get queue names for a given domain event type.
 * Returns an empty array if no route is defined.
 */
export function getQueuesForEvent(eventType: string): string[] {
  // For simplicity, iterate; in production you would use the cached map.
  return INTEGRATION_EVENT_ROUTES
    .filter((r) => r.domainEventType === eventType)
    .map((r) => r.queueName);
}
