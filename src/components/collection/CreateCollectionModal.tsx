"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BasicInfoStep } from "@/components/collection/BasicInfoStep";
import { OptionalDetailsStep } from "@/components/collection/OptionalDetailsStep";
import { BecomeStackerModal } from "@/components/auth/BecomeStackerModal";
import { useToast } from "@/contexts/ToastContext";
import type { CollectionVisibility } from "@/types";

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromCardCreation?: boolean;
  onCollectionCreated?: (collectionId: string) => void;
}

type Step = "basic" | "details";

export function CreateCollectionModal({
  isOpen,
  onClose,
  fromCardCreation = false,
  onCollectionCreated,
}: CreateCollectionModalProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [step, setStep] = useState<Step>("basic");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<CollectionVisibility>("public");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showBecomeStacker, setShowBecomeStacker] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("basic");
        setTitle("");
        setDescription("");
        setTags([]);
        setVisibility("public");
        setCoverImage(null);
        setCoverImagePreview(null);
        setError("");
        setIsLoading(false);
        setIsDragging(false);
        setShowBecomeStacker(false);
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadRole = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();
      setUserRole(profile?.role || "user");
    };
    loadRole();
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setCoverImage(file);
    setError("");
    const reader = new FileReader();
    reader.onloadend = () => setCoverImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // FIX: Added optional param to skip check during recursive call
  const handleSubmit = async (skipRoleCheck = false) => {
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("You must be logged in");

      if (
        !skipRoleCheck &&
        visibility === "public" &&
        userRole !== "stacker" &&
        userRole !== "admin"
      ) {
        setShowBecomeStacker(true);
        setIsLoading(false);
        return;
      }

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      let coverImageUrl: string | null = null;
      if (coverImage) {
        const ext = coverImage.name.split(".").pop();
        const fileName = `${data.user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("cover-images")
          .upload(fileName, coverImage);
        if (uploadError) throw new Error("Failed to upload image");
        const { data: urlData } = supabase.storage
          .from("cover-images")
          .getPublicUrl(fileName);
        coverImageUrl = urlData.publicUrl;
      }

      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description: description || null,
          tags,
          is_public: visibility === "public",
          is_hidden: visibility === "unlisted",
          cover_image_url: coverImageUrl,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        // Fallback for server-side check
        if (response.status === 403 && result.become_stacker_required) {
          setShowBecomeStacker(true);
          setIsLoading(false);
          return;
        }
        throw new Error(result.error || "Failed to create collection");
      }

      showSuccess("Collection created!");

      if (fromCardCreation && onCollectionCreated) {
        onCollectionCreated(result.id);
        onClose();
        return;
      }

      onClose();
      router.push(`/collection/${result.slug || result.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      showError(err.message || "Failed to create collection");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Collection"
      size="md"
    >
      <div className="relative min-h-[60vh] md:min-h-[450px]">
        <div
          className={`absolute inset-0 transition-transform duration-300 ${
            step === "basic"
              ? "translate-x-0"
              : "-translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <BasicInfoStep
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            tags={tags}
            onTagsChange={setTags}
            error={error}
            isLoading={isLoading}
            onCancel={onClose}
            onNext={() => {
              if (!title.trim()) return setError("Title is required");
              setError("");
              setStep("details");
            }}
          />
        </div>

        <div
          className={`absolute inset-0 transition-transform duration-300 ${
            step === "details"
              ? "translate-x-0"
              : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <OptionalDetailsStep
            visibility={visibility}
            onVisibilityChange={setVisibility}
            coverImage={coverImage}
            coverImagePreview={coverImagePreview}
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onImageChange={(e) =>
              e.target.files?.[0] && handleFileSelect(e.target.files[0])
            }
            error={error}
            isLoading={isLoading}
            onBack={() => setStep("basic")}
            onSubmit={() => handleSubmit(false)}
          />
        </div>
      </div>

      <BecomeStackerModal
        isOpen={showBecomeStacker}
        onClose={() => {
          setShowBecomeStacker(false);
          // Don't downgrade visibility on close, let user decide
        }}
        onSuccess={() => {
          setUserRole("stacker");
          setShowBecomeStacker(false);
          // FIX: Pass true to skip role check since we just became a Stacker
          handleSubmit(true);
        }}
      />
    </Modal>
  );
}
