import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { ValidationError } from '@csn/domain-shared';
import { Publication } from '../aggregates/publication';
import { PublicationId } from '../value-objects/publication-id';
import { PublicationContent } from '../value-objects/publication-content';
import { PublicationStatus } from '../value-objects/publication-status';
import { Visibility } from '../value-objects/visibility';
import { GroupId } from '../value-objects/group-id';

function create(groupId: GroupId | null = null): Publication {
  return Publication.create(
    PublicationId.generate(),
    UserId.generate(),
    PublicationContent.create('Hello'),
    Visibility.PUBLIC,
    groupId,
  );
}

describe('Publication group association', () => {
  it('should default groupId to null for a personal post', () => {
    // Act
    const publication = create();

    // Assert
    expect(publication.groupId).toBeNull();
  });

  it('should report a personal post as not belonging to a group', () => {
    // Act
    const publication = create();

    // Assert
    expect(publication.belongsToGroup()).toBe(false);
  });

  it('should keep the group id supplied at creation', () => {
    // Arrange
    const groupId = GroupId.generate();

    // Act
    const publication = create(groupId);

    // Assert
    expect(publication.groupId!.value).toBe(groupId.value);
  });

  it('should report a group post as belonging to a group', () => {
    // Act
    const publication = create(GroupId.generate());

    // Assert
    expect(publication.belongsToGroup()).toBe(true);
  });

  it('should restore the group id when reconstituted from persistence', () => {
    // Arrange
    const groupId = GroupId.generate();
    const now = Timestamp.now();

    // Act
    const publication = Publication.reconstitute(
      PublicationId.generate(),
      UserId.generate(),
      PublicationContent.create('Hello'),
      Visibility.GROUP_ONLY,
      PublicationStatus.PUBLISHED,
      [],
      [],
      new Map<string, number>(),
      now,
      now,
      1,
      groupId,
    );

    // Assert
    expect(publication.groupId!.value).toBe(groupId.value);
  });

  it('should reconstitute as a personal post when no group id is supplied', () => {
    // Arrange
    const now = Timestamp.now();

    // Act
    const publication = Publication.reconstitute(
      PublicationId.generate(),
      UserId.generate(),
      PublicationContent.create('Hello'),
      Visibility.PUBLIC,
      PublicationStatus.PUBLISHED,
      [],
      [],
      new Map<string, number>(),
      now,
      now,
      1,
    );

    // Assert
    expect(publication.groupId).toBeNull();
  });
});

describe('GroupId (content context)', () => {
  it('should accept a UUID', () => {
    // Act
    const id = GroupId.create('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

    // Assert
    expect(id.value).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should reject a non-UUID value', () => {
    // Act / Assert
    expect(() => GroupId.create('nope')).toThrow(ValidationError);
  });

  it('should reject an empty value', () => {
    // Act / Assert
    expect(() => GroupId.create('')).toThrow(ValidationError);
  });

  it('should generate a distinct id on each call', () => {
    // Act
    const first = GroupId.generate();
    const second = GroupId.generate();

    // Assert
    expect(first.value).not.toBe(second.value);
  });
});
