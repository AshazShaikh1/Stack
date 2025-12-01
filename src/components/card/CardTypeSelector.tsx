'use client';

interface CardTypeSelectorProps {
  onSelect: (type: 'link' | 'image' | 'docs') => void;
}

export function CardTypeSelector({ onSelect }: CardTypeSelectorProps) {
  return (
    <div className="p-6">
      <h2 className="text-h1 font-bold text-jet-dark mb-6">Create Card</h2>
      
      <div className="space-y-3">
        <button
          onClick={() => onSelect('link')}
          className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
              <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-h2 font-semibold text-jet-dark mb-1">Link</h3>
              <p className="text-body text-gray-muted">Add a resource link from the web</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelect('image')}
          className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
              <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-h2 font-semibold text-jet-dark mb-1">Image</h3>
              <p className="text-body text-gray-muted">Upload an image file</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelect('docs')}
          className="w-full p-4 rounded-lg border-2 border-gray-light hover:border-jet transition-all duration-200 text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-light flex items-center justify-center flex-shrink-0 group-hover:bg-jet/10 transition-colors">
              <svg className="w-6 h-6 text-jet-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-h2 font-semibold text-jet-dark mb-1">Document</h3>
              <p className="text-body text-gray-muted">Upload a document file</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

