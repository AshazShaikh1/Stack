'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface BasicInfoStepProps {
  title: string;
  onTitleChange: (title: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  tags: string;
  onTagsChange: (tags: string) => void;
  error: string;
  isLoading: boolean;
  onCancel: () => void;
  onNext: () => void;
}

export function BasicInfoStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  tags,
  onTagsChange,
  error,
  isLoading,
  onCancel,
  onNext,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Input
        type="text"
        label="Title"
        placeholder="My Awesome Stack"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        required
        disabled={isLoading}
      />

      <div>
        <label className="block text-body font-medium text-jet-dark mb-2">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe what this stack is about..."
          className="w-full px-4 py-3 rounded-input border border-gray-light text-body text-jet-dark placeholder:text-gray-muted focus:outline-none focus:ring-2 focus:ring-jet focus:border-transparent disabled:bg-gray-light disabled:cursor-not-allowed resize-none"
          rows={3}
          disabled={isLoading}
        />
      </div>

      <Input
        type="text"
        label="Tags (comma-separated)"
        placeholder="design, inspiration, tools"
        value={tags}
        onChange={(e) => onTagsChange(e.target.value)}
        helperText="Separate tags with commas (max 10)"
        disabled={isLoading}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-input text-small text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          disabled={isLoading || !title.trim()}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

