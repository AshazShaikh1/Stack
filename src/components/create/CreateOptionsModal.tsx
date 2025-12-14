"use client";

import { useState, lazy, Suspense } from "react";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

const CreateCollectionModal = lazy(() =>
  import("@/components/collection/CreateCollectionModal").then((m) => ({
    default: m.CreateCollectionModal,
  }))
);
const CreateCardModal = lazy(() =>
  import("@/components/card/CreateCardModal").then((m) => ({
    default: m.CreateCardModal,
  }))
);

interface CreateOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOptionsModal({
  isOpen,
  onClose,
}: CreateOptionsModalProps) {
  const [selectedOption, setSelectedOption] = useState<
    "collection" | "card" | null
  >(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const handleOptionSelect = (option: "collection" | "card") => {
    setSelectedOption(option);
    onClose();
    if (option === "collection") setIsCollectionModalOpen(true);
    else if (option === "card") setIsCardModalOpen(true);
  };

  const ModalFallback = () => (
    <div className="p-6">
      <Skeleton variant="rectangular" height={200} className="w-full mb-4" />
      <Skeleton variant="text" height={40} width="60%" />
    </div>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Create New">
        <div className="space-y-4">
          {/* Collection Option */}
          <button
            onClick={() => handleOptionSelect("collection")}
            className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50/30 active:scale-[0.98] transition-all duration-200 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-jet-dark mb-1 group-hover:text-emerald-700 transition-colors">
                  Collection
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Group resources into a themed stack. Perfect for curating
                  topics.
                </p>
              </div>
            </div>
          </button>

          {/* Card Option */}
          <button
            onClick={() => handleOptionSelect("card")}
            className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/30 active:scale-[0.98] transition-all duration-200 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-jet-dark mb-1 group-hover:text-blue-700 transition-colors">
                  Resource Card
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Save a single link, article, or tool.
                </p>
              </div>
            </div>
          </button>
        </div>
      </Modal>

      {isCollectionModalOpen && (
        <Suspense fallback={<ModalFallback />}>
          <CreateCollectionModal
            isOpen={isCollectionModalOpen}
            onClose={() => {
              setIsCollectionModalOpen(false);
              setSelectedOption(null);
            }}
            onCollectionCreated={() => {
              setIsCollectionModalOpen(false);
              setSelectedOption(null);
            }}
          />
        </Suspense>
      )}

      {isCardModalOpen && (
        <Suspense fallback={<ModalFallback />}>
          <CreateCardModal
            isOpen={isCardModalOpen}
            onClose={() => {
              setIsCardModalOpen(false);
              setSelectedOption(null);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
