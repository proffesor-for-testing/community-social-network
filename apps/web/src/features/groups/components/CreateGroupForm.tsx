import React, { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import { useCreateGroup } from '../hooks/useCreateGroup';

export function CreateGroupForm() {
  const createMutation = useCreateGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'secret'>('public');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim(), visibility });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Create a New Group
      </h2>

      <FormField
        label="Group Name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={100}
        placeholder="Enter group name..."
      />

      <div className="w-full">
        <label
          htmlFor="create-description"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Description <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="create-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className="input-base resize-none"
          placeholder="Describe what this group is about..."
          required
        />
      </div>

      <div className="w-full">
        <label
          htmlFor="create-visibility"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Visibility
        </label>
        <select
          id="create-visibility"
          name="visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'public' | 'private' | 'secret')}
          className="input-base"
        >
          <option value="public">Public -- anyone can join</option>
          <option value="private">Private -- membership requires approval</option>
          <option value="secret">Secret -- invite only, hidden from search</option>
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={createMutation.isPending} disabled={!name.trim() || !description.trim()}>
          Create Group
        </Button>
      </div>
    </form>
  );
}
