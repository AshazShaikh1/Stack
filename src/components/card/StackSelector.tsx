'use client';

import { Button } from '@/components/ui/Button';
import Image from 'next/image';

interface Collection {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
}

interface StackSelectorProps {
  stacks?: Collection[]; // Legacy support - renamed to collections
  collections?: Collection[];
  selectedStackId?: string; // Legacy support
  selectedCollectionId?: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  error?: string;
}

export function StackSelector({
  stacks,
  collections,
  selectedStackId,
  selectedCollectionId,
  onSelect,
  onCreateNew,
  onBack,
  onSubmit,
  isLoading,
  error,
}: StackSelectorProps) {
  const items = collections || stacks || [];
  const selectedId = selectedCollectionId || selectedStackId || '';
  
  return (
    <div className="p-6 space-y-4 max-w-sm mx-auto">
      <h2 className="text-h1 font-bold text-jet-dark mb-6">Select Collection</h2>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((collection) => (
          <button
            key={collection.id}
            onClick={() => onSelect(collection.id)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
              selectedId === collection.id
                ? 'border-jet bg-jet/5'
                : 'border-gray-light hover:border-jet/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {collection.cover_image_url ? (
                <Image
                  src={collection.cover_image_url}
                  alt={collection.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center text-jet font-semibold">
                  {collection.title.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-body font-semibold text-jet-dark">{collection.title}</h3>
                {collection.description && (
                  <p className="text-small text-gray-muted line-clamp-1">{collection.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Create New Collection Button */}
      <button
        onClick={onCreateNew}
        className="w-full p-4 rounded-lg border-2 border-dashed border-gray-light hover:border-jet/50 transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center text-jet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div>
            <h3 className="text-body font-semibold text-jet-dark">Create new collection</h3>
            <p className="text-small text-gray-muted">Add a new collection to save this card</p>
          </div>
        </div>
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
          {error}
        </div>
      )}

      {/* Option to create standalone card */}
      <div className="pt-4 border-t border-gray-light">
        <button
          onClick={onSubmit}
          className="w-full p-3 rounded-lg border-2 border-dashed border-gray-light hover:border-jet/50 transition-all text-center"
        >
          <span className="text-body text-jet-dark font-medium">Create as standalone card</span>
          <p className="text-small text-gray-muted mt-1">Save without adding to a collection</p>
        </button>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          onClick={onSubmit}
          isLoading={isLoading}
        >
          {selectedId ? 'Add to Collection' : 'Create Card'}
        </Button>
      </div>
    </div>
  );
}

