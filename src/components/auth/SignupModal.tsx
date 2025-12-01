'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Modal } from '@/components/ui/Modal';
import Image from 'next/image';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

export function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setProfilePicture(file);
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName) {
      setError('Display name is required');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        console.error('Error checking username:', checkError);
      }

      if (existingUser) {
        setError('Username is already taken. Please choose another one.');
        setIsLoading(false);
        return;
      }

      // Sign up the user with metadata for profile creation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            username: username.toLowerCase(),
          },
        },
      });

      if (signUpError) {
        // Provide more specific error messages
        let errorMessage = signUpError.message;
        if (signUpError.message.includes('email')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (signUpError.message.includes('password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Wait for database trigger to create user profile
        // Poll for user profile to be created (max 3 seconds)
        let profileCreated = false;
        for (let i = 0; i < 30; i++) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('id')
            .eq('id', authData.user.id)
            .single();
          
          if (userProfile) {
            profileCreated = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!profileCreated) {
          setError('Profile creation failed. Please try again or contact support.');
          setIsLoading(false);
          return;
        }

        // Upload profile picture if provided
        if (profilePicture && authData.user && authData.session) {
          try {
            // Ensure we have a session before uploading
            const fileExt = profilePicture.name.split('.').pop();
            const fileName = `${authData.user.id}/${Date.now()}.${fileExt}`;
            
            // Use the session-aware client for upload
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, profilePicture, {
                cacheControl: '3600',
                upsert: false
              });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
              
              // Update user profile with avatar URL
              const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', authData.user.id);

              if (updateError) {
                console.error('Error updating avatar:', updateError);
                // Don't fail signup if avatar upload fails
              }
            } else {
              console.error('Error uploading avatar:', uploadError);
              // Don't fail signup if avatar upload fails
            }
          } catch (avatarError) {
            console.error('Avatar upload error:', avatarError);
            // Don't fail signup if avatar upload fails
          }
        }
        
        // Check if email confirmation is required
        if (authData.session) {
          // User is immediately signed in (email confirmation disabled)
          onClose();
          // Force a hard navigation to ensure the page updates immediately
          window.location.href = '/';
        } else {
          // Email confirmation required
          // Show success message
          setError('');
          alert('Account created! Please check your email to confirm your account before signing in.');
          onClose();
          onSwitchToLogin?.();
        }
      } else {
        setError('User creation failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Signup error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setEmail('');
    setPassword('');
    setUsername('');
    setDisplayName('');
    setProfilePicture(null);
    setProfilePicturePreview(null);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm">
      <div className="text-center mb-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 bg-jet rounded-lg flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <span className="text-h2 font-bold text-jet-dark">Stack</span>
        </div>
        
        {/* Welcome Text */}
        <h2 className="text-h2 font-semibold text-jet-dark mb-2">
          Welcome to Stack
        </h2>
      </div>

      <div className="relative overflow-hidden">
        {/* Step 1: Email, Username, Password */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 1 ? 'translate-x-0' : '-translate-x-full absolute inset-0'
          }`}
        >
          <form onSubmit={handleStep1Next} className="space-y-4 max-w-sm mx-auto">
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />

            <Input
              type="text"
              label="Username"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              disabled={isLoading}
              helperText="Only letters, numbers, and underscores"
            />

            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              Continue
            </Button>
          </form>
        </div>

        {/* Step 2: Display Name and Profile Picture */}
        <div
          className={`transition-transform duration-300 ease-in-out ${
            step === 2 ? 'translate-x-0' : 'translate-x-full absolute inset-0'
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
            <Input
              type="text"
              label="Display Name"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              disabled={isLoading}
            />

            <div className="w-full">
              <label className="block text-body font-medium text-jet-dark mb-2">
                Profile Picture
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative w-full border-2 border-dashed rounded-lg transition-all ${
                  isDragging
                    ? 'border-jet bg-jet/5'
                    : 'border-gray-light hover:border-jet/50'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden"
                  id="profile-picture-upload"
                  disabled={isLoading}
                />
                <label
                  htmlFor="profile-picture-upload"
                  className="flex items-center gap-4 px-4 py-4 cursor-pointer"
                >
                  <div className="relative w-20 h-20 rounded-lg bg-gray-light flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profilePicturePreview ? (
                      <Image
                        src={profilePicturePreview}
                        alt="Profile preview"
                        fill
                        className="object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-jet/20 flex items-center justify-center text-2xl font-bold text-jet">
                        {displayName.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {profilePicture ? (
                      <>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          {profilePicture.name}
                        </p>
                        <p className="text-small text-gray-muted">
                          Click or drag to change photo
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-body text-jet-dark font-medium mb-1">
                          Drag and drop a photo here
                        </p>
                        <p className="text-small text-gray-muted">
                          or click to browse
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>
              <p className="mt-1 text-small text-gray-muted">
                Optional - You can add this later. Files are saved to: Supabase Storage → avatars bucket → {`{user_id}`}/
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-small text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isLoading}
              >
                Create account
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-body text-gray-muted">
          Already have an account?{' '}
          <button
            onClick={() => {
              handleClose();
              onSwitchToLogin?.();
            }}
            className="text-jet font-medium hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </Modal>
  );
}
