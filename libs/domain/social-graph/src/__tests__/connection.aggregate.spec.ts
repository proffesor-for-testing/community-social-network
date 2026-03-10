import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Connection } from '../aggregates/connection';
import { ConnectionId } from '../value-objects/connection-id';
import { ConnectionStatus, ConnectionStatusEnum } from '../value-objects/connection-status';
import { FollowRequestedEvent } from '../events/follow-requested.event';
import { FollowApprovedEvent } from '../events/follow-approved.event';
import { FollowRejectedEvent } from '../events/follow-rejected.event';
import { UnfollowedEvent } from '../events/unfollowed.event';
import { CannotFollowSelfError } from '../errors/cannot-follow-self.error';
import { InvalidStatusTransitionError } from '../errors/invalid-status-transition.error';

describe('Connection Aggregate', () => {
  const createConnectionId = () => ConnectionId.generate();
  const createUserId = () => UserId.generate();

  describe('request()', () => {
    it('should create a pending connection request', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();

      const connection = Connection.request(id, followerId, followeeId);

      expect(connection.id).toBe(id);
      expect(connection.followerId.equals(followerId)).toBe(true);
      expect(connection.followeeId.equals(followeeId)).toBe(true);
      expect(connection.status.value).toBe(ConnectionStatusEnum.PENDING);
      expect(connection.createdAt).toBeDefined();
    });

    it('should emit FollowRequestedEvent on creation', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();

      const connection = Connection.request(id, followerId, followeeId);
      const events = connection.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(FollowRequestedEvent);

      const event = events[0] as FollowRequestedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.followerId).toBe(followerId.value);
      expect(event.followeeId).toBe(followeeId.value);
      expect(event.aggregateType).toBe('Connection');
      expect(event.eventType).toBe('FollowRequested');
    });

    it('should throw CannotFollowSelfError when follower equals followee', () => {
      const id = createConnectionId();
      const userId = createUserId();

      expect(() => Connection.request(id, userId, userId)).toThrow(
        CannotFollowSelfError,
      );
    });

    it('should throw CannotFollowSelfError with correct error code', () => {
      const id = createConnectionId();
      const userId = createUserId();

      try {
        Connection.request(id, userId, userId);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CannotFollowSelfError);
        expect((error as CannotFollowSelfError).code).toBe('CANNOT_FOLLOW_SELF');
      }
    });
  });

  describe('approve()', () => {
    it('should transition from PENDING to ACCEPTED', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.pullDomainEvents(); // clear creation event

      connection.approve();

      expect(connection.status.value).toBe(ConnectionStatusEnum.ACCEPTED);
    });

    it('should emit FollowApprovedEvent', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();
      const connection = Connection.request(id, followerId, followeeId);
      connection.pullDomainEvents(); // clear creation event

      connection.approve();
      const events = connection.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(FollowApprovedEvent);

      const event = events[0] as FollowApprovedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.followerId).toBe(followerId.value);
      expect(event.followeeId).toBe(followeeId.value);
      expect(event.aggregateType).toBe('Connection');
      expect(event.eventType).toBe('FollowApproved');
    });

    it('should increment version on approve', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      expect(connection.version).toBe(0);

      connection.approve();

      expect(connection.version).toBe(1);
    });

    it('should throw InvalidStatusTransitionError when approving from REJECTED', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.reject();

      expect(() => connection.approve()).toThrow(InvalidStatusTransitionError);
    });

    it('should throw InvalidStatusTransitionError when approving an already ACCEPTED connection', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.approve();

      expect(() => connection.approve()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reject()', () => {
    it('should transition from PENDING to REJECTED', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.pullDomainEvents();

      connection.reject();

      expect(connection.status.value).toBe(ConnectionStatusEnum.REJECTED);
    });

    it('should emit FollowRejectedEvent', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();
      const connection = Connection.request(id, followerId, followeeId);
      connection.pullDomainEvents();

      connection.reject();
      const events = connection.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(FollowRejectedEvent);

      const event = events[0] as FollowRejectedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.followerId).toBe(followerId.value);
      expect(event.followeeId).toBe(followeeId.value);
      expect(event.aggregateType).toBe('Connection');
      expect(event.eventType).toBe('FollowRejected');
    });

    it('should increment version on reject', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );

      connection.reject();

      expect(connection.version).toBe(1);
    });

    it('should throw InvalidStatusTransitionError when rejecting from ACCEPTED', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.approve();

      expect(() => connection.reject()).toThrow(InvalidStatusTransitionError);
    });

    it('should throw InvalidStatusTransitionError when rejecting an already REJECTED connection', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.reject();

      expect(() => connection.reject()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('unfollow()', () => {
    it('should emit UnfollowedEvent from ACCEPTED status', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();
      const connection = Connection.request(id, followerId, followeeId);
      connection.approve();
      connection.pullDomainEvents(); // clear previous events

      connection.unfollow();
      const events = connection.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UnfollowedEvent);

      const event = events[0] as UnfollowedEvent;
      expect(event.aggregateId).toBe(id.value);
      expect(event.followerId).toBe(followerId.value);
      expect(event.followeeId).toBe(followeeId.value);
      expect(event.aggregateType).toBe('Connection');
      expect(event.eventType).toBe('Unfollowed');
    });

    it('should increment version on unfollow', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.approve();
      const versionAfterApprove = connection.version;

      connection.unfollow();

      expect(connection.version).toBe(versionAfterApprove + 1);
    });

    it('should throw InvalidStatusTransitionError when unfollowing from PENDING', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );

      expect(() => connection.unfollow()).toThrow(InvalidStatusTransitionError);
    });

    it('should throw InvalidStatusTransitionError when unfollowing from REJECTED', () => {
      const connection = Connection.request(
        createConnectionId(),
        createUserId(),
        createUserId(),
      );
      connection.reject();

      expect(() => connection.unfollow()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute without emitting events', () => {
      const id = createConnectionId();
      const followerId = createUserId();
      const followeeId = createUserId();

      const connection = Connection.reconstitute(
        id,
        followerId,
        followeeId,
        ConnectionStatus.accepted(),
        Timestamp.now(),
        5,
      );

      expect(connection.pullDomainEvents()).toHaveLength(0);
      expect(connection.version).toBe(5);
      expect(connection.status.value).toBe(ConnectionStatusEnum.ACCEPTED);
    });
  });

  describe('entity equality', () => {
    it('should be equal when IDs match', () => {
      const id = createConnectionId();
      const conn1 = Connection.request(id, createUserId(), createUserId());
      const conn2 = Connection.request(id, createUserId(), createUserId());

      expect(conn1.equals(conn2)).toBe(true);
    });

    it('should not be equal when IDs differ', () => {
      const followerId = createUserId();
      const followeeId = createUserId();
      const conn1 = Connection.request(createConnectionId(), followerId, followeeId);
      const conn2 = Connection.request(createConnectionId(), followerId, followeeId);

      expect(conn1.equals(conn2)).toBe(false);
    });
  });
});
