import React, { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/atoms/Button';
import { FormField } from '../../../shared/components/molecules/FormField';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useGroup } from '../hooks/useGroup';
import { groupKeys, updateGroup, deleteGroup } from '../queries';
import type { GroupDto, CreateGroupDto } from '../../../api/types';
import { parseApiError, type ApiError } from '../../../api/error-handler';
import { useToastStore } from '../../../stores/toast.store';

export function GroupSettings() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: group, isLoading } = useGroup(groupId!);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'secret'>('public');

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description);
      setVisibility(group.visibility);
    }
  }, [group]);

  const updateMutation = useMutation<GroupDto, ApiError, Partial<CreateGroupDto>>({
    mutationFn: (dto) => updateGroup(groupId!, dto),
    onSuccess: (data) => {
      queryClient.setQueryData(groupKeys.detail(groupId!), data);
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      addToast('Group updated', 'success');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const deleteMutation = useMutation<void, ApiError, void>({
    mutationFn: () => deleteGroup(groupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      addToast('Group deleted', 'success');
      navigate('/communities');
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      addToast(parsed.message, 'error');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, description, visibility });
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Group Settings
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <FormField
          label="Group Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />

        <div className="w-full">
          <label
            htmlFor="description"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
            className="input-base resize-none"
            required
          />
        </div>

        <div className="w-full">
          <label
            htmlFor="visibility"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'private' | 'secret')}
            className="input-base"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="secret">Secret</option>
          </select>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Danger zone */}
      <div className="card border-red-200 dark:border-red-800">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
          Danger Zone
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Deleting this group is irreversible. All members will be removed.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this group?')) {
              deleteMutation.mutate();
            }
          }}
          loading={deleteMutation.isPending}
        >
          Delete Group
        </Button>
      </div>
    </div>
  );
}
