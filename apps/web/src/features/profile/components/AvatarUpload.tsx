import React, { useCallback, useRef, useState, type DragEvent } from 'react';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Button } from '../../../shared/components/atoms/Button';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useToastStore } from '../../../stores/toast.store';

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  displayName: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarUpload({ currentAvatarUrl, displayName }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useAvatarUpload();
  const addToast = useToastStore((s) => s.addToast);

  const validateAndUpload = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        addToast('Please upload a JPEG, PNG, or WebP image.', 'error');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        addToast('Image must be smaller than 5 MB.', 'error');
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation, addToast],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUpload(file);
    }
    // Reset so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndUpload(file);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar src={currentAvatarUrl} alt={displayName} size="xl" />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-4 transition-colors',
          isDragging
            ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
            : 'border-gray-300 dark:border-gray-600',
        ].join(' ')}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drag and drop an image, or
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          loading={uploadMutation.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Choose File
        </Button>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          JPEG, PNG, or WebP. Max 5 MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload avatar"
        />
      </div>
    </div>
  );
}
