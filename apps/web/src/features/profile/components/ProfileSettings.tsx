import React, { useState, useEffect, type FormEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useProfile } from '../hooks/useProfile';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { AvatarUpload } from './AvatarUpload';

export function ProfileSettings() {
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio ?? '');
      setLocation(profile.location ?? '');
      setWebsite(profile.website ?? '');
    }
  }, [profile]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ displayName, bio, location, website });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AvatarUpload
        currentAvatarUrl={profile?.avatarUrl ?? null}
        displayName={profile?.displayName ?? ''}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Display Name"
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={100}
        />

        <div className="w-full">
          <label
            htmlFor="bio"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            className="input-base resize-none"
            placeholder="Tell us about yourself..."
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {bio.length}/500
          </p>
        </div>

        <FormField
          label="Location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
          maxLength={100}
        />

        <FormField
          label="Website"
          name="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
          maxLength={200}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
