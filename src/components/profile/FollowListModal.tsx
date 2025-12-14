"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
}

export function FollowListModal({
  isOpen,
  onClose,
  userId,
  type,
}: FollowListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user: currentUser } = useAuth();

  // 1. Define the function first using useCallback
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/follows/${userId}?type=${type}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, type]);

  // 2. Use useEffect after the function definition
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === "followers" ? "Followers" : "Following"}
    >
      <div className="flex flex-col max-h-[60vh] min-h-[300px]">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald/20 border-t-emerald rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-muted">
            <div className="text-4xl mb-2">👥</div>
            <p>No {type} yet</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between group"
                >
                  <Link
                    href={`/profile/${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1"
                  >
                    {user.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt={user.display_name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-jet/10 flex items-center justify-center text-jet font-bold text-sm">
                        {user.display_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-jet-dark group-hover:text-emerald transition-colors">
                        {user.display_name}
                      </div>
                      <div className="text-sm text-gray-muted">
                        @{user.username}
                      </div>
                    </div>
                  </Link>

                  {currentUser?.id !== user.id && (
                    <Link href={`/profile/${user.username}`} onClick={onClose}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
